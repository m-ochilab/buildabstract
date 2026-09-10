import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../public/assets/index-D2VAdRgQ.js", import.meta.url);
let source = await readFile(file, "utf8");

const replacements = [
  [
    "$s=[[`logic`,`全体の論理の説得性`],[`problem`,`問題の具体性`],[`objective`,`目的の具体性`],[`methods`,`方法の具体性`],[`challenge`,`課題の具体性`],[`experiment`,`実験の具体性`],[`expected_results`,`結果の定量性`],[`discussion`,`考察の具体性`],[`conclusion`,`結論の具体性`],[`contribution`,`貢献の具体性`]]",
    "$s=[[`background`,`背景の明確性（研究文脈と必要性）`],[`problem`,`問題の具体性`],[`objective`,`目的の具体性`],[`methods`,`方法の具体性`],[`challenge`,`課題の具体性`],[`experiment`,`実験の具体性`],[`expected_results`,`結果の定量性`],[`discussion`,`考察の具体性`],[`conclusion`,`結論の具体性`],[`contribution`,`貢献の具体性`],[`logic`,`要素間の論理的一貫性`]]"
  ],
  ["-Math.PI/2+t*Math.PI/5", "-Math.PI/2+t*2*Math.PI/$s.length"],
  ["全体生成の10観点", "全体生成の11観点"],
  ["生成結果の10観点", "生成結果の11観点"],
  ["判定基準は全10項目8点以上", "判定基準は全11観点8点以上"],
  ["replace(`全体の論理の説得性`,`論理`)", "replace(`背景の明確性（研究文脈と必要性）`,`背景`).replace(`要素間の論理的一貫性`,`一貫性`)"],
  ["[`runs`,`events`,`research_runs`,`research_sources`]", "[`runs`,`events`,`research_runs`,`research_sources`,`completions`,`section_scores`]"],
  ["実行履歴と操作履歴の2ファイルを出力しました。", "分析用の6ファイルを出力しました。"]
];

for (const [before, after] of replacements) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected one occurrence, found ${occurrences}: ${before}`);
  }
  source = source.replace(before, after);
}

await writeFile(file, source);
