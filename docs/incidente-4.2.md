# Incidente §4.2 · "o retorno da semana de 20/11/2023 caiu de 31% para 18%"

**Requisitos:** SU-4.2-01 a SU-4.2-05.

## O sintoma, em números

| Semana | Dashboard: novos | Dashboard: voltaram | Dashboard: retorno | Relatório (hashed_ip): novos | Relatório: voltaram | Relatório: retorno |
|---|---:|---:|---:|---:|---:|---:|
| 06/11 | 1.210 | 375 | 31,0% | 1.150 | 345 | 30% |
| 13/11 | 1.188 | 368 | 31,0% | 1.131 | 351 | 31% |
| **20/11** | **2.034** | 366 | **18,0%** | 1.172 | 352 | 30% |

O numerador (voltaram) é praticamente o mesmo nas duas fontes; quem quase **dobra é o denominador**: o dashboard vê **862 "novos" a mais** numa semana em que o relatório vê um volume normal. A queda não é de comportamento: é de **contagem de pessoas**.

## 1. Por onde começaria e por quê

Pela **divergência entre as duas fontes**, não pela tela. O relatório conta direto na base bruta e está estável; o dashboard diverge só numa semana e só no denominador. Isso descarta a base bruta (as duas fontes leem a mesma) e aponta para o que é **diferente entre elas**: a definição de usuário. O relatório conta por `hashed_ip`; a carga grava `usuario_id = sha256(hashed_ip | user-agent)`. Primeira pergunta: "quantos dos 2.034 novos de 20/11 são IPs que já existiam antes com outro user-agent?"

## 2. Em qual camada está a falha e as evidências

**Na carga** (base bruta → base analítica), não no endpoint nem na tela:

- A tela mostra exatamente o que o endpoint devolve (`novos: 2034`, `voltaram_7d: 366` → 18,0%).
- O endpoint calcula certo sobre o que recebe: o SQL agrupa por `usuario_id`, e o problema é o que `usuario_id` significa.
- A carga muda a identidade da pessoa quando o **user-agent muda** (atualização do navegador ou do app, troca de celular para computador). Se numa semana muitos navegadores atualizaram (ou o cliente mudou o cabeçalho), a mesma pessoa vira um `usuario_id` novo: entra como "novo" na coorte de 20/11 e, como a pessoa já usava o produto, o "retorno" dela fica atribuído à identidade antiga, não à nova.
- A base bruta está certa: o relatório, que lê dela por `hashed_ip`, é estável.

**Consulta de confirmação** (na base bruta; mesma regra do endpoint, trocando só a chave):

```sql
WITH conv AS (
    SELECT hashed_ip, header ->> 'user-agent' AS ua, "timestamp" AS ts
    FROM bruto.wildchat
    WHERE country = 'Brazil'
),
primeira_ip   AS (SELECT hashed_ip,     min(ts) AS p FROM conv GROUP BY 1),
primeira_ipua AS (SELECT hashed_ip, ua, min(ts) AS p FROM conv GROUP BY 1, 2)
SELECT date_trunc('week', u.p)::date                          AS semana,
       count(*)                                               AS novos_ip_mais_ua,
       count(*) FILTER (WHERE i.p < date_trunc('week', u.p))  AS ip_ja_existia_antes,
       (SELECT count(*) FROM primeira_ip x
         WHERE date_trunc('week', x.p) = date_trunc('week', u.p)) AS novos_so_ip
FROM primeira_ipua u
JOIN primeira_ip i USING (hashed_ip)
WHERE u.p >= '2023-11-06' AND u.p < '2023-11-27'
GROUP BY 1
ORDER BY 1;
```

A hipótese se confirma se, em 20/11, `novos_ip_mais_ua` ≈ 2.034, `novos_so_ip` ≈ 1.172 e `ip_ja_existia_antes` ≈ 860. Complemento: a distribuição de `user-agent` (versão do navegador) em 13/11 × 20/11 mostra qual mudança disparou a troca.

## 3. O trecho que causa o problema e a correção

**Causa principal:** a chave de usuário inclui o user-agent.

```python
chave = f"{c['hashed_ip']}|{c['header']['user-agent']}"
```

**Causas secundárias no mesmo código** (não explicam o salto de 20/11, mas distorcem o número):

| Trecho | Problema |
|---|---|
| `ON CONFLICT (conversa_id) DO NOTHING` | A carga diária recebe de novo uma conversa que continuou em outro dia; `DO NOTHING` descarta o novo `ultimo_turno`. Retornos dentro de conversas antigas somem. E corrigir a chave **não conserta as linhas já gravadas**. |
| `min(ultimo_turno) AS primeira_vez` | Usa o **último** turno como "primeira vez": desloca a coorte e pode transformar a própria 1ª conversa em retorno. |
| `date_trunc('week', ...)` sem fuso | A semana é cortada no fuso da sessão do banco (UTC), não no do negócio. |
| `EXISTS (SELECT 1 FROM analytics.conversas c WHERE c.usuario_id = ...)` sem `pais` | O filtro de país está só na CTE `primeira`: uma conversa da mesma pessoa em outro país conta como retorno no dashboard do Brasil. |

**Correção da carga:**

```python
SAL = os.environ["SAL_USUARIO"]  # sal fixo: o usuario_id não é reversível para o IP

def carregar_conversas(conversas: list[dict]) -> None:
    """Grava uma linha por conversa. Idempotente: reprocessar o mesmo dia dá o mesmo resultado."""
    for c in conversas:
        db.execute(
            """
            INSERT INTO analytics.conversas
                (conversa_id, usuario_id, primeiro_turno, ultimo_turno, modelo, turnos, pais)
            VALUES
                (%(conversa_id)s, %(usuario_id)s, %(primeiro_turno)s, %(ultimo_turno)s,
                 %(modelo)s, %(turnos)s, %(pais)s)
            ON CONFLICT (conversa_id) DO UPDATE SET
                usuario_id   = EXCLUDED.usuario_id,
                ultimo_turno = EXCLUDED.ultimo_turno,
                turnos       = EXCLUDED.turnos,
                modelo       = EXCLUDED.modelo
            """,
            {
                "conversa_id": c["conversation"][0]["turn_identifier"],
                # mesma chave do relatório e do BDR-001: só o IP (user-agent muda com atualização do navegador)
                "usuario_id": sha256((SAL + c["hashed_ip"]).encode()).hexdigest(),
                "primeiro_turno": c["conversation"][1]["timestamp"],  # 1ª resposta: o usuário não tem horário
                "ultimo_turno": c["timestamp"],
                "modelo": c["model"],
                "turnos": c["turn"],
                "pais": c["country"],
            },
        )
```

**Correção do endpoint:** `min(primeiro_turno)` no lugar de `min(ultimo_turno)`, semana no fuso do negócio e o país também no retorno:

```sql
WITH primeira AS (
    SELECT usuario_id, min(primeiro_turno) AS primeira_vez
    FROM analytics.conversas
    WHERE pais = $3
    GROUP BY usuario_id
)
SELECT date_trunc('week', p.primeira_vez AT TIME ZONE 'America/Sao_Paulo')::date AS semana,
       count(*) AS novos,
       count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM analytics.conversas c
           WHERE c.usuario_id = p.usuario_id
             AND c.pais = $3
             AND c.primeiro_turno > p.primeira_vez + interval '1 hour'
             AND c.primeiro_turno <= p.primeira_vez + interval '7 days'
       )) AS voltaram_7d
FROM primeira p
WHERE p.primeira_vez >= $1 AND p.primeira_vez < $2
GROUP BY 1
ORDER BY 1
```

## 4. O que mais precisa ser feito e como evitar que volte

**Além do código:**
1. **Reprocessar todo o histórico** (todas as linhas têm o `usuario_id` errado, e `DO NOTHING` impediria a correção): carga completa numa tabela nova e troca atômica (`ALTER TABLE ... RENAME` na mesma transação), sem a tela ver dado pela metade.
2. **Medir o estrago:** quais semanas e telas mudaram depois do reprocessamento, e quanto.
3. **Avisar quem usou o número** (ver item 5) e registrar o incidente.

**Para não voltar:**
- **Teste de reconciliação automático** depois de cada carga: novos por semana na base analítica × contagem direta na base bruta por `hashed_ip`; diferença acima de 2% bloqueia a publicação e alerta o time **antes** do cliente.
- **Teste de contrato da definição de usuário:** duas conversas com o mesmo IP e user-agents diferentes têm de gerar o mesmo `usuario_id` (no nosso projeto: `tests/test_definicoes.py`).
- **Monitor de anomalia:** razão `usuario_id distintos / hashed_ip distintos` por semana; salto acima do histórico dispara alerta.
- **Carga idempotente** (apagar a janela e recarregar na mesma transação), não `DO NOTHING`.
- **Toda mudança de definição passa por BDR** e muda um teste: a chave com user-agent não teria passado na revisão.

## 5. O que dizer à gerente de produto

**Durante:**
> "Identificamos que o número de 20/11 está errado, não o comportamento dos usuários: o relatório que conta direto na base continua estável em 30%. O dashboard está contando a mesma pessoa duas vezes quando o navegador dela muda, e isso dobrou os 'novos' daquela semana. Por favor, não use o retorno de 20/11 para decisão até corrigirmos. Próxima atualização hoje às [hora]."

**Depois:**
> "Causa: a regra que identifica a pessoa incluía o navegador; quando muitos navegadores atualizaram em 20/11, quase 900 pessoas que já usavam o produto apareceram como novas. Corrigimos a regra e recalculamos todas as semanas: 20/11 fica em ~30%, como no relatório; as outras semanas mudaram no máximo [x] pp. Agora, a cada carga, o dashboard é conferido automaticamente contra a base bruta e não publica se divergir."

## Observação

Os volumes do enunciado (~1.150 novos por semana no Brasil) são de uma implementação de referência: na base real do WildChat-1M, o Brasil tem ~45 novos usuários por semana (2.266 elegíveis em 53 semanas). As respostas acima tratam o caso como descrito no enunciado.
