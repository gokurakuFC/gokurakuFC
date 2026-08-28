GOKURAKU FC 公式サイト Ver.1

■ 開き方
1. フォルダ内の index.html をダブルクリック
2. ブラウザでサイトを確認できます

■ 現在設定済み
- ロゴ
- 活動紹介
- YouTube: https://youtube.com/@miyashitanojikan
- X: https://x.com/GOKURAKUFC
- PC / スマホ対応
- 湯気アニメーション
- 加入相談導線

■ YouTube LIVE自動表示について
index.html の一番下にある
const LIVE_CHANNEL_ID = "";
の "" 内へ「UCから始まるYouTubeチャンネルID」を入力すると、
配信中のライブを自動埋め込みする設定になります。

例:
const LIVE_CHANNEL_ID = "UCxxxxxxxxxxxxxxxxxxxxxx";

YouTubeチャンネルIDは YouTube のアカウント詳細画面などで確認できます。

■ Ver.1.1 修正
- トップ：『極楽FC』を大きく、『GOKURAKU FC』を小さく変更
- 『FOOTBALL × ONSEN × ENJOY』はいったん削除
- 活動紹介上部の3項目目を『楽しみながら真剣にサッカー議論』へ変更
- 社会人向けの日程調整・出場機会への配慮を追記
- JOIN項目に『サッカー議論をしたい』『パブリックで参加したい』を追加

■ Ver.1.4
- MATCHESセクションを追加
- 各試合の上部に大会名を表示する設計
- 「次戦」と「直近結果」を自動選択する設計
- 試合日経過後、スコア未入力なら「結果反映待ち」を自動表示
- VPG公式カレンダーへのリンクを追加

■ Ver.1.5
- VPG Japan Challenge Cupの大会ページを自動確認する仕組みを追加
- GitHub Actions + Playwrightで約3時間ごとに試合情報を取得
- VPGの内部JSON通信を自動探索し、取れない場合は画面DOMから抽出
- HPはdata/matches.jsonを自動読込
- 試合日経過＋スコア未反映は「結果反映待ち」
- VPG障害時に過去データを消さない安全策あり

■ Ver.1.6
- GitHub Pagesの公開をGitHub Actions方式に変更
- VPG自動取得後、そのまま最新サイトを自動再公開
- 試合情報更新のたびに手動でHP更新する必要がない構成
