# 観察課題と根拠の確認状況

確認日：2026-10-23。参照：[京都市動物園 どうぶつ図鑑](https://zoo.city.kyoto.lg.jp/zoo/animals/)。16グループは提供された暫定リストです。MIKECA正式30カードの検証は未完了です。公式ページへの掲載は現地展示・本日の観察可能性を保証しません。

全16グループで選択・課題表示・描画・解説表示を実装しています。写真は全て未提供。ヤギのSVG以外のお手本と自動判定は未実装です。問いは開発上の提案であり、公式図鑑の課題ではありません。

| 動物／部位 | 観察の問い | 公式図鑑で確認した内容／残る未確認事項 |
| --- | --- | --- |
| [マンドリル](https://zoo.city.kyoto.lg.jp/zoo/animals/m_sphinx)／顔 | 鼻の両側の色や溝の並び | 成長個体の鼻の溝、年齢・性別による色の違い。色の生態的役割は未確認 |
| [シロテテナガザル](https://zoo.city.kyoto.lg.jp/zoo/animals/h_lar)／腕 | 枝をつかむ腕の長さと形 | 長い腕による枝間移動、地上でのバランス |
| [ワオキツネザル](https://zoo.city.kyoto.lg.jp/zoo/animals/l_catta)／目 | 目のまわりの形と色 | 名前は尾の輪模様に由来。目のまわりの模様の働きは未確認 |
| [ヤギ](https://zoo.city.kyoto.lg.jp/zoo/animals/c_aegagrus)・ヒツジ／目 | 黒い部分の形 | ヤギの瞳孔の働きは下記研究による説明。ヒツジ個別の課題・素材・説明は準備中 |
| [アジアゾウ](https://zoo.city.kyoto.lg.jp/zoo/animals/e_maximus)／頭 | 頭から鼻の輪郭 | 上唇と鼻が伸びた鼻を食物取得に使用 |
| [フサオマキザル](https://zoo.city.kyoto.lg.jp/zoo/animals/c_apella)／尻尾 | 尾の曲げ方・巻き方 | 尾でものをつかみ体重を支える |
| [アカゲザル](https://zoo.city.kyoto.lg.jp/zoo/animals/m_mulatta)／尻 | 輪郭と毛のある部分 | 樹上と地上で生活、母系の群れ。尻の特徴の働きは未確認 |
| [ニホンアナグマ](https://zoo.city.kyoto.lg.jp/zoo/animals/m_meles)／顔 | 顔の模様の位置と形 | 爪で巣穴を掘る。顔の模様の働きは未確認 |
| シマウマ／指・ひづめ | 足先のひづめの輪郭 | 参照一覧に対象種の項目を確認できず。種・掲載状況・部位の解説全て未確認。選択肢は暫定リストとして維持 |
| [キリン](https://zoo.city.kyoto.lg.jp/zoo/animals/g_camelopardalis)／指・舌 | 足先と食べるときの舌 | 最も背が高い現生動物。指定部位の説明は未確認 |
| [カバ](https://zoo.city.kyoto.lg.jp/zoo/animals/h_amphibius)／顔・からだ | 水中で見える部分 | 日中は水中・水辺で休む。皮膚乾燥を防ぐ赤い分泌液 |
| [フェネック](https://zoo.city.kyoto.lg.jp/zoo/animals/v_zerda)／足・尻尾 | 毛と輪郭 | 巣穴で暑さ・冷気を避ける。足と尾の働きは未確認 |
| [ニシゴリラ](https://zoo.city.kyoto.lg.jp/zoo/animals/g_gorilla)／頭 | 頭から顔の輪郭 | 熱帯雨林、植物や昆虫を食べる。頭の形と役割の説明は未確認 |
| [ロバ](https://zoo.city.kyoto.lg.jp/zoo/animals/e_asinus)／背中 | 線と模様 | アフリカノロバ由来の家畜。背中の模様の働きは未確認 |
| [ミーアキャット](https://zoo.city.kyoto.lg.jp/zoo/animals/s_suricatta-2)／顔 | 目のまわりの模様 | トンネルを掘り家族で暮らす。模様の働きは未確認 |
| [ニホンジカ（園の表記はホンシュウジカ）](https://zoo.city.kyoto.lg.jp/zoo/animals/c_nippon)／背中 | 季節ごとの毛と模様 | 夏毛の白斑は冬毛で消える。模様の生態的働きは未確認 |

ヤギの瞳孔の説明は [Banksほか（2015）](https://doi.org/10.1126/sciadv.1500391) の光学モデル・観察研究に基づきます。「地面に沿って周囲を広く見渡すのに役立つと考えられる」と表現し、すべての状況での機能を断定していません。

データの正本は `src/content/groups.ts`。`explanationStatus` はverified（表示する事実を確認済み）、partial（指定部位の未確認事項を含む）、unverified（対象自体も確認中）です。関連する一般事実が確認済みでも、指定部位の働きまで確認できた扱いにはしていません。
