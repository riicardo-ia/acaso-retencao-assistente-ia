"""Camada bruta: baixa o WildChat-1M e guarda só as conversas do Brasil.

Os 14 arquivos (~3,4 GB) são baixados um por vez; cada um é filtrado e apagado
antes do próximo, para caber em disco. A execução é retomável: um arquivo já
filtrado não é baixado de novo. As contagens (total x Brasil) de cada arquivo
ficam em `contagens.json`, a prova de que o filtro não perdeu nem inventou linhas.

Uso: python -m etl.extrair [pasta_destino]
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

import duckdb

URL = "https://huggingface.co/datasets/allenai/WildChat-1M/resolve/main/data/train-{i:05d}-of-00014.parquet"
N_ARQUIVOS = 14
PAIS = "Brazil"


TENTATIVAS, TIMEOUT_S = 4, 60


def baixar(url: str, destino: Path) -> None:
    """Download com timeout por leitura e novas tentativas: uma conexão que para no meio
    não trava a carga (urlretrieve não tem timeout)."""
    for tentativa in range(1, TENTATIVAS + 1):
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT_S) as r, open(
                destino, "wb"
            ) as f:
                while bloco := r.read(1 << 20):
                    f.write(bloco)
            return
        except OSError as erro:
            print(f"download falhou ({tentativa}/{TENTATIVAS}): {erro}", flush=True)
            time.sleep(10 * tentativa)
    raise RuntimeError(f"não foi possível baixar {url}")


def filtrar_arquivo(origem: Path, destino: Path, pais: str) -> tuple[int, int]:
    """Grava em `destino` só as linhas de `pais`. Devolve (linhas na origem, linhas gravadas)."""
    con = duckdb.connect()
    total = con.execute(
        "SELECT count(*) FROM read_parquet(?)", [str(origem)]
    ).fetchone()[0]  # type: ignore[index]
    con.execute(
        f"COPY (SELECT * FROM read_parquet('{origem}') WHERE country = ?) TO '{destino}' (FORMAT parquet)",
        [pais],
    )
    filtradas = con.execute(
        "SELECT count(*) FROM read_parquet(?)", [str(destino)]
    ).fetchone()[0]  # type: ignore[index]
    return int(total), int(filtradas)


def extrair(pasta: Path) -> Path:
    partes_dir = pasta / "partes"
    partes_dir.mkdir(parents=True, exist_ok=True)
    arq_contagens = pasta / "contagens.json"
    contagens: dict[str, dict[str, int]] = (
        json.loads(arq_contagens.read_text()) if arq_contagens.exists() else {}
    )

    for i in range(N_ARQUIVOS):
        nome = f"train-{i:05d}"
        parte = partes_dir / f"{nome}-brazil.parquet"
        if nome in contagens and parte.exists():
            continue
        baixado = partes_dir / f"{nome}.parquet"
        inicio = time.monotonic()
        baixar(URL.format(i=i), baixado)
        total, filtradas = filtrar_arquivo(baixado, parte, PAIS)
        baixado.unlink()
        contagens[nome] = {"total": total, "brasil": filtradas}
        arq_contagens.write_text(json.dumps(contagens, indent=2))
        print(
            f"{nome}: {total} linhas, {filtradas} do Brasil ({time.monotonic() - inicio:.0f}s)",
            flush=True,
        )

    destino = pasta / "wildchat_brazil.parquet"
    duckdb.execute(
        f"COPY (SELECT * FROM read_parquet('{partes_dir}/*-brazil.parquet')) TO '{destino}' (FORMAT parquet)"
    )
    total = sum(c["total"] for c in contagens.values())
    brasil = sum(c["brasil"] for c in contagens.values())
    print(f"TOTAL: {total} linhas, {brasil} do Brasil -> {destino}", flush=True)
    return destino


if __name__ == "__main__":
    extrair(Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/raw"))
