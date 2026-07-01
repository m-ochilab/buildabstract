# buildabstract

情報工学全般のジャーナル論文を前提に、アブストラクト構成要素を短文で順番に詰めながら、AI に項目別フィードバックと修正候補を出してもらう Web アプリです。最後に、全入力からタイトルとアブストラクト案をまとめて生成します。

## できること

- 背景、問題、目的、課題、方法、実験、想定結果、考察、結論、貢献を順に入力
- 各項目ごとに AI フィードバックと修正候補を生成
- 全入力からタイトルを生成
- 全入力からアブストラクト案を生成
- キーワード、全体メモ、次に詰めるとよい点を提示
- 推敲結果を Markdown でダウンロード
- 合格時のみ `論文執筆会に確認依頼を投稿` ボタンを表示し、Synology Chat に通知
- UI から `OpenRouter` と `Ollama` を切り替え可能

## 技術構成

- Backend: `FastAPI`
- Frontend: `HTML / CSS / Vanilla JavaScript`
- LLM: `OpenRouter` / `Ollama`
- Storage: `SQLite`

## 前提

- `Python 3.12+`
- `OpenRouter` を使う場合は API キーがあること
- `Ollama` を使う場合は `Ollama` が起動していること
- `Ollama` を使う場合は推敲に使うモデルが `ollama list` 相当で見えること

## セットアップ

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 起動

```bash
source .venv/bin/activate
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

ブラウザで `http://localhost:8000` を開きます。

## 環境変数

`.env` は起動時に自動読み込みされます。

```bash
cp .env.example .env
```

OpenRouter を使う最小設定:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-xxxx
OPENROUTER_MODEL=google/gemini-2.5-pro
OPENROUTER_MAX_CONCURRENCY=10
```

このアプリでは、OpenRouter の API キーが入っていると `Ollama` より OpenRouter を優先します。論文用途の既定モデルは `google/gemini-2.5-pro` にしてあります。

主な環境変数:

- `OPENROUTER_API_KEY`
- `OPENROUTER_API_KEYS`
- `OPENROUTER_MODEL`
- `OPENROUTER_MAX_CONCURRENCY`
- `OLLAMA_URL`
- `OLLAMA_URLS`
- `OLLAMA_MODEL`
- `OLLAMA_TIMEOUT_SECONDS`
- `GUIDANCE_PATH`
  - 既定値: `./guidance.txt`
  - 推敲時のガイド文です
- `SYNOLOGY_CHAT_WEBHOOK_URL`
  - 合格時に `論文執筆会に確認依頼を投稿` ボタンから通知する先です

## API

### `GET /api/health`

現在使っているバックエンド、固定モデル、ガイドファイル位置を返します。

### `POST /api/revise-section`

単一項目のフィードバックと修正候補を返します。

送信例:

```bash
curl -X POST http://127.0.0.1:8000/api/revise-section \
  -F "field_name=methods" \
  -F "target_language=ja" \
  -F "background=大規模言語モデルを使った学習支援が広がっている" \
  -F "problem=学習者ごとの質問意図に応じた支援品質が安定しない" \
  -F "objective=質問意図を考慮した応答生成の有効性を検証する" \
  -F "challenge=質問意図の推定誤りが支援品質を下げる" \
  -F "methods=質問文の分類と応答生成を組み合わせた手法を提案する"
```

### `POST /api/generations`

全入力からタイトルとアブストラクト案を生成します。

送信例:

```bash
curl -X POST http://127.0.0.1:8000/api/generations \
  -F "target_language=ja" \
  -F "background=大規模言語モデルを使った学習支援が広がっている" \
  -F "problem=学習者ごとの質問意図に応じた支援品質が安定しない" \
  -F "objective=質問意図を考慮した応答生成の有効性を検証する" \
  -F "challenge=質問意図の推定誤りが支援品質を下げる" \
  -F "methods=質問文の分類と応答生成を組み合わせた手法を提案する" \
  -F "experiment=既存手法との比較実験を行う" \
  -F "expected_results=学習支援の適合度向上が期待される" \
  -F "discussion=質問意図を考慮することで応答品質改善が示せる可能性がある" \
  -F "conclusion=提案法は個別化学習支援の改善に寄与する" \
  -F "contribution=質問意図を考慮した学習支援設計の有効性を示す"
```

### `POST /api/generations/{generation_id}/notify-writing-club`

合格判定になった生成結果を Synology Chat に投稿します。`SYNOLOGY_CHAT_WEBHOOK_URL` が未設定の場合は利用できません。

## 推敲ガイドの調整

推敲ルールは [guidance.txt](/root/buildabstract/guidance.txt) で管理します。コメントの厳しさ、断定的な文体の強さ、タイトル生成の傾向などを調整したい場合はここを編集してください。
