# ADR-002 · Base analítica: schema `mart` no Postgres, papel de leitura e carga com reconciliação

**Status:** aceito

## Contexto

O PDF exige que o dashboard **não leia a base bruta** e que os dados passem por uma base analítica desenhada por nós. As conversas podem ter dados pessoais. O incidente do §4.2 mostra o que acontece quando a carga muda a definição sem ninguém perceber.

## Opções consideradas

| Opção | Avaliação |
|---|---|
| DuckDB em arquivo | Simples, mas o dashboard e a carga dividiriam o arquivo; sem papéis de acesso |
| Redshift / Athena | Escala que o volume (11,6 mil conversas) não pede |
| **Postgres com schema `mart` e dois papéis** | Escolhida |

## Decisão

- **Base bruta** = parquet do Brasil (no S3 em produção), montada **só** no container da carga.
- **`mart`** guarda conversas e eventos **sem texto, IP ou user-agent** (usuário = `sha256(sal + hashed_ip)`), as views de definição do retorno, a view materializada das coortes e as tabelas de resultado da análise.
- **Papéis:** `bi_etl` é dono do `mart`; `bi_app` só tem `SELECT` e sessão somente leitura (`default_transaction_read_only`), com `statement_timeout` de 5 s.
- **Carga idempotente:** apaga e recarrega tudo na mesma transação; migrações numeradas em `etl/sql/`.
- **Reconciliação:** o retorno por coorte calculado em SQL (`mart.vw_usuarios`) é comparado com o calculado em Python (`analise/definicoes.py`); se divergir, a transação não é publicada e a carga sai com erro. Cada execução grava procedência em `mart.cargas`.

## Consequências

- Um erro como o do §4.2 (chave de usuário diferente da definição) quebra a carga antes de chegar à tela.
- O IC 95% de cada coorte é calculado no banco (`mart.wilson`), não no JavaScript.
- Em produção: RDS Postgres com backup automático; a carga em ECS agendada (EventBridge), com reprocessamento por janela de datas.
