# GOKURAKU FC - VPG automatic match sync

この版では、VPGの大会ページ
https://virtualprogaming.com/league/Japan-Challenge-Cup/matches
を約3時間ごとに自動確認して、GOKURAKU FCの試合情報を `data/matches.json` に保存する仕組みを追加しています。

## 動き
1. GitHub Actions が定期起動
2. Chromium（実ブラウザ相当）でVPGページを開く
3. VPGページが裏で取得しているJSON通信を優先して解析
4. JSONから取れない場合は、表示済み画面から「GOKURAKU FC」を含む試合カードを探索
5. 大会名・日時・ホーム/アウェー・スコアを保存
6. HPは `data/matches.json` を読み、直近結果と次戦を表示

## 結果反映待ち
試合日時を過ぎているのにスコアが取得できない場合、HP側が自動で「結果反映待ち」と表示します。

## 安全策
VPG側の一時障害や仕様変更で取得件数が0になった場合、すでに取得済みの試合データを空データで上書きしません。

## 注意
この自動更新はGitHub等に公開し、GitHub Actionsが動作して初めて定期実行されます。
ローカルで index.html を開くだけでは自動更新処理は走りません。


## Ver.1.6 公開方式
GitHub Pages の Source は「GitHub Actions」を選択してください。
このワークフロー自身が、VPG取得後に最新の index.html / assets / data をPagesへ公開します。
そのため、VPGデータ更新後も手動でHPを再公開する必要はありません。
