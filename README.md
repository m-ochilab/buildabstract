# BuildAbstract

研究アイデアの各要素を一文に絞り、課題・目的・方法・検証を具体化して、実際の研究を進める指針となるアブストラクトへつなげる AI 支援 Web アプリです。論文の書き方を教えることや文章表現の推敲だけを目的とせず、曖昧な着想を実行可能な研究構想へ変換することを支援します。

## できること

- 背景、問題、目的、課題、方法、検証、想定結果、考察、結論、アイデアの核を一文ずつ入力
- 各項目の曖昧さを AI が指摘し、一つの判断が伝わる一文へ具体化
- 問い、到達点、検証する作業、アイデアの核を研究コンパスで確認
- 全入力から研究タイトルと、研究を進める指針となるアブストラクトを生成
- 次に決めること、調べること、試すことを具体的な作業として提示
- 生成結果を Markdown でダウンロード
- 合格時のみ `論文執筆会に確認依頼を投稿` ボタンを表示し、Synology Chat に通知
- UI から `OpenRouter` と `Ollama` を切り替え可能
- 評価実験用に A（一括生成）・B（10項目入力のみ）・C（項目別AI支援）を順序均衡化して割り当て、操作ログを保存

## 技術構成

- Backend: `FastAPI`
- Frontend: `HTML / CSS / Vanilla JavaScript`
- LLM: `OpenRouter` / `Ollama`
- Storage: `SQLite`

## 前提

- `Python 3.12+`
- `OpenRouter` を使う場合は API キーがあること
- `Ollama` を使う場合は `Ollama` が起動していること
- `Ollama` を使う場合は AI 支援に使うモデルが `ollama list` 相当で見えること

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
  - 研究構想を具体化する際のガイド文です
- `SYNOLOGY_CHAT_WEBHOOK_URL`
  - 合格時に `論文執筆会に確認依頼を投稿` ボタンから通知する先です

`.env` は起動時に一度だけ読み込まれるため、本番環境(systemd)で運用している場合は `.env` を編集したら必ずサービスを再起動してください。再起動しないと古い設定のまま動き続け、例えば `SYNOLOGY_CHAT_WEBHOOK_URL` を追加しても「webhook が未設定です」というエラーが出続けます。

```bash
sudo systemctl restart buildabstract
```

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

一文ずつ具体化した全入力から、研究タイトルと研究を進める指針となるアブストラクトを生成します。

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

## 評価実験

画面上部の「実験セッションを開始」から、同意済み参加者の匿名ID、研究類型、研究段階を入力して開始します。参加者ごとに Latin square の3順序で A/B/C が割り当てられ、同一IDで次回を開始すると次の条件になります。

保存するのは匿名ID、条件、研究類型・段階、候補ID、要求・採用・棄却・編集、修正前後、タイムスタンプです。氏名は評価ログのCSVに出力しません。

- `GET /api/study/summary`: 条件別の完了数、候補提示数・採用率、編集文字量、平均所要時間
- `GET /api/study/export.csv`: 解析用の匿名イベントログCSV

条件Aは研究構想の一括入力から一括生成、条件Bは10項目の手入力のみ、条件Cは項目別のAI候補を採用・編集・棄却できる通常方式です。教員による盲検評価用には、CSVの `generation_id` から生成原稿を取り出し、参加者ID・条件を除外した原稿を配布してください。

## 生成ガイドの調整

研究構想の具体化ルールは [guidance.txt](/root/buildabstract/guidance.txt) で管理します。コメントの厳しさ、一文への絞り込み、タイトル生成の傾向などを調整したい場合はここを編集してください。
