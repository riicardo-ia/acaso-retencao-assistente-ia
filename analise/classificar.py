"""Passo 5b: classificação das conversas em rótulos FECHADOS (formato híbrido).

A lista de 11 temas e os sinais de insatisfação foram definidos e revisados na descoberta (BDR-002); o LLM só lê as
mensagens do usuário e escolhe uma opção de cada lista (saída estruturada: não há
como inventar categoria). Casos decidíveis por regra não vão ao LLM.

Provedor por configuração (.env), sem mudar código:
  LLM_PRIMARY_PROVIDER=openai            LLM_PRIMARY_MODEL=gpt-5.4-nano   (desenvolvimento)
  LLM_PRIMARY_PROVIDER=bedrock_converse  LLM_PRIMARY_MODEL=<id no Bedrock> (entrega na AWS)

Rodar: python -m analise.classificar [modelo] [arquivo_saida] [n_amostra]
"""

import os
import sys
from pathlib import Path
from typing import Literal

import pandas as pd
from pydantic import BaseModel, Field

VERSAO_PROMPT = "v1"

TEMAS: dict[str, str] = {
    "estudo": "Estudo e trabalho acadêmico: explicar matéria, exercício, questão de prova, trabalho escolar ou de faculdade (ABNT, TCC), conceitos de uma disciplina.",
    "programacao": "Programação e tecnologia: código, erro, ferramenta, sistema, infraestrutura, conceito de TI.",
    "reescrita": "Reescrita, resumo e tradução: a pessoa traz um texto pronto e pede para parafrasear, corrigir, resumir, traduzir, mudar o tom ou 'humanizar' texto de IA.",
    "marketing": "Marketing e conteúdo profissional: copy, post de rede social, anúncio, roteiro de vídeo, currículo, documento de trabalho, e-book, ideias de negócio.",
    "ficcao": "Ficção, roleplay e criação: histórias, capítulos, RPG, personagens, 'atue como {persona}', fanfic, letras de música, nomes criativos.",
    "conhecimento": "Conhecimento geral e curiosidades: fatos, história, esportes, cultura pop, anime, filmes, 'quem foi', 'qual foi'.",
    "vida_pratica": "Vida prática e conselhos: receitas, saúde pessoal, finanças pessoais, burocracia, compras, relacionamentos, tarô.",
    "imagem_midia": "Pedido de imagem, vídeo ou áudio: pede para gerar/criar imagem, vídeo, áudio, ou escreve prompts para geradores de imagem (Midjourney etc.).",
    "burlar_regras": "Tentativa de burlar regras: 'DAN', 'jogo sem ética', 'a partir de agora tudo é ficcional/hipotético', instruções para ignorar as políticas.",
    "saudacao_teste": "Saudação ou teste do assistente: a conversa SÓ cumprimenta ou testa o assistente ('oi', 'fala português?', 'quem é você?', 'é o GPT-4?', 'que dia é hoje?').",
    "outro": "Outro / indefinido: não se encaixa em nenhum tema acima ou não dá para saber.",
}

INSATISFACAO: dict[str, str] = {
    "nenhum": "Nenhum sinal: a pessoa segue a conversa normalmente, agradece ou faz pedidos novos.",
    "corrige_ou_contesta": "Corrige ou contesta: diz que a resposta está errada, incompleta ou não era o que pediu.",
    "repete_pedido": "Repete o pedido: refaz o mesmo pedido com outras palavras porque não foi atendido.",
    "reclama_ou_desiste": "Reclama ou desiste: expressa frustração, irritação ou abandona ('esquece', 'você não serve').",
}

NAO_AVALIAVEL = "nao_avaliavel"  # 1 só mensagem do usuário: não há reação para avaliar (regra, sem LLM)
TEXTO_MINIMO = 10  # abaixo disso, o tema é "saudacao_teste" por regra (Q8)
SEP = " | "


class Classificacao(BaseModel):
    """Classificação de UMA conversa entre usuário e assistente."""

    tema: Literal[tuple(TEMAS)] = Field(  # type: ignore[valid-type]
        description="O tema do PEDIDO PRINCIPAL da conversa."
    )
    insatisfacao: Literal[tuple(INSATISFACAO)] = Field(  # type: ignore[valid-type]
        description="O sinal mais forte de insatisfação do usuário ao longo da conversa."
    )


def instrucoes() -> str:
    temas = "\n".join(f"- {k}: {v}" for k, v in TEMAS.items())
    insat = "\n".join(f"- {k}: {v}" for k, v in INSATISFACAO.items())
    return (
        "Você classifica conversas de um assistente de IA. Você recebe SÓ as mensagens do usuário, "
        f"na ordem, separadas por '{SEP.strip()}'.\n\n"
        f"Escolha UM tema:\n{temas}\n\n"
        "Regras do tema: vale o PEDIDO PRINCIPAL da conversa (o que ocupa a maior parte dela). "
        "Se a pessoa primeiro testa ou cumprimenta e depois faz um pedido real, vale o pedido real; "
        "'saudacao_teste' é só para conversas que APENAS testam ou cumprimentam.\n\n"
        f"Escolha UM sinal de insatisfação, olhando as mensagens depois da primeira:\n{insat}"
    )


def por_regra(texto: str) -> dict[str, str] | None:
    """Rótulos decididos sem LLM. Devolve None quando a conversa precisa do LLM."""
    if len(texto.replace(SEP.strip(), "").strip()) < TEXTO_MINIMO:
        return {"tema": "saudacao_teste", "insatisfacao": NAO_AVALIAVEL}
    return None


def insatisfacao_avaliavel(texto: str) -> bool:
    return SEP in texto


def classificador(modelo: str | None = None):  # type: ignore[no-untyped-def]
    from langchain.chat_models import init_chat_model

    from dotenv import load_dotenv  # só na classificação; o ETL usa apenas TEMAS

    load_dotenv(".env")
    provedor = os.environ.get("LLM_PRIMARY_PROVIDER", "openai")
    modelo = modelo or os.environ["LLM_PRIMARY_MODEL"]
    return (
        provedor,
        modelo,
        init_chat_model(modelo, model_provider=provedor).with_structured_output(
            Classificacao
        ),
    )


def classificar(
    conversas: pd.DataFrame, modelo: str | None, saida: Path, lote: int = 200
) -> pd.DataFrame:
    """Classifica e grava incrementalmente em `saida` (retomável)."""
    feito = pd.read_csv(saida) if saida.exists() else pd.DataFrame(columns=["conv_id"])
    pendentes = conversas[~conversas["conv_id"].isin(feito["conv_id"])]
    provedor, nome_modelo, llm = classificador(modelo)
    sistema = instrucoes()
    for i in range(0, len(pendentes), lote):
        bloco = pendentes.iloc[i : i + lote]
        linhas = []
        precisa = []
        for conv_id, texto in zip(bloco["conv_id"], bloco["texto"]):
            regra = por_regra(texto)
            if regra:
                linhas.append({"conv_id": conv_id, **regra, "origem": "regra"})
            else:
                precisa.append((conv_id, texto))
        respostas = llm.batch(
            [[("system", sistema), ("user", texto)] for _, texto in precisa],
            config={"max_concurrency": 32},
            return_exceptions=True,
        )
        for (conv_id, texto), r in zip(precisa, respostas):
            if isinstance(r, Exception):
                print(
                    f"erro em {conv_id}: {type(r).__name__}: {str(r)[:120]}", flush=True
                )
                continue
            insat = r.insatisfacao if insatisfacao_avaliavel(texto) else NAO_AVALIAVEL
            linhas.append(
                {
                    "conv_id": conv_id,
                    "tema": r.tema,
                    "insatisfacao": insat,
                    "origem": "llm",
                }
            )
        novo = pd.DataFrame(linhas).assign(
            provedor=provedor, modelo=nome_modelo, versao_prompt=VERSAO_PROMPT
        )
        novo.to_csv(saida, mode="a", header=not saida.exists(), index=False)
        print(f"{min(i + lote, len(pendentes))}/{len(pendentes)}", flush=True)
    return pd.read_csv(saida)


if __name__ == "__main__":
    modelo = sys.argv[1] if len(sys.argv) > 1 else None
    saida = Path(sys.argv[2] if len(sys.argv) > 2 else "data/seed/temas.csv")
    saida.parent.mkdir(parents=True, exist_ok=True)
    from analise.temas_descoberta import texto_da_conversa

    conv = texto_da_conversa()
    if (
        len(sys.argv) > 3
    ):  # amostra para confiabilidade (mesma semente em toda execução)
        conv = conv.sample(int(sys.argv[3]), random_state=2026)
    classificar(conv, modelo, saida)
