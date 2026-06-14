
import { Story } from './types';

export const STORIES: Story[] = [
  // --- FRENCH STORIES ---
  {
    id: 1,
    language: 'french',
    title: "Ma routine du matin",
    level: "A1",
    content: "Je me réveille à sept heures. Je prends une douche et je m'habille. Ensuite, je mange un croissant et je bois du café. Je pars travailler à huit heures.",
    translation: "I wake up at seven o'clock. I take a shower and get dressed. Then, I eat a croissant and drink some coffee. I leave for work at eight o'clock.",
    vocabulary: [
      { word: "réveille", phonetic: "/ʁe.vɛj/", translation: "wakes up" },
      { word: "douche", phonetic: "/duʃ/", translation: "shower" },
      { word: "habille", phonetic: "/a.bij/", translation: "get dressed" },
      { word: "croissant", phonetic: "/kʁwa.sɑ̃/", translation: "croissant" }
    ]
  },
  {
    id: 2,
    language: 'french',
    title: "Au marché",
    level: "A1",
    content: "Le samedi, je vais au marché. J'achète des pommes rouges et des légumes frais. Le marchand est très gentil. J'aime l'ambiance du marché.",
    translation: "On Saturdays, I go to the market. I buy red apples and fresh vegetables. The merchant is very nice. I like the atmosphere of the market.",
    vocabulary: [
      { word: "marché", phonetic: "/maʁ.ʃe/", translation: "market" },
      { word: "légumes", phonetic: "/le.ɡym/", translation: "vegetables" },
      { word: "marchand", phonetic: "/maʁ.ʃɑ̃/", translation: "merchant" },
      { word: "ambiance", phonetic: "/ɑ̃.bjɑ̃s/", translation: "atmosphere" }
    ]
  },
  {
    id: 3,
    language: 'french',
    title: "Mon chat Oliver",
    level: "A1",
    content: "J'ai un petit chat noir. Il s'appelle Oliver. Il aime dormir sur le canapé toute la journée. Le soir, il joue avec une balle bleue.",
    translation: "I have a small black cat. His name is Oliver. He likes to sleep on the sofa all day. In the evening, he plays with a blue ball.",
    vocabulary: [
      { word: "chat", phonetic: "/ʃa/", translation: "cat" },
      { word: "canapé", phonetic: "/ka.na.pe/", translation: "sofa" },
      { word: "joue", phonetic: "/ʒu/", translation: "plays" },
      { word: "balle", phonetic: "/bal/", translation: "ball" }
    ]
  },
  {
    id: 4,
    language: 'french',
    title: "La famille Dupont",
    level: "A1",
    content: "Monsieur et Madame Dupont habitent à Lyon. Ils ont deux enfants, Pierre et Marie. Le dimanche, ils vont souvent se promener dans le parc de la Tête d'Or.",
    translation: "Mr. and Mrs. Dupont live in Lyon. They have two children, Pierre and Marie. On Sundays, they often go for a walk in the Tête d'Or park.",
    vocabulary: [
      { word: "habitent", phonetic: "/a.bit/", translation: "live" },
      { word: "enfants", phonetic: "/ɑ̃.fɑ̃/", translation: "children" },
      { word: "promener", phonetic: "/pʁɔ.m(ə).ne/", translation: "to walk" },
      { word: "parc", phonetic: "/paʁk/", translation: "park" }
    ]
  },
  {
    id: 5,
    language: 'french',
    title: "Mes loisirs",
    level: "A1",
    content: "J'adore la musique. Je joue de la guitare depuis trois ans. J'aime aussi lire des livres d'aventure le soir avant de dormir.",
    translation: "I love music. I have been playing the guitar for three years. I also like reading adventure books in the evening before sleeping.",
    vocabulary: [
      { word: "guitare", phonetic: "/ɡi.taʁ/", translation: "guitar" },
      { word: "depuis", phonetic: "/də.pɥi/", translation: "since/for" },
      { word: "aventure", phonetic: "/a.vɑ̃.tyʁ/", translation: "adventure" },
      { word: "dormir", phonetic: "/dɔʁ.miʁ/", translation: "to sleep" }
    ]
  },
  {
    id: 6,
    language: 'french',
    title: "Un voyage à Paris",
    level: "A2",
    content: "L'été dernier, je suis allé à Paris avec mes amis. Nous avons visité la Tour Eiffel et le musée du Louvre. La ville était magnifique, mais il y avait beaucoup de touristes.",
    translation: "Last summer, I went to Paris with my friends. We visited the Eiffel Tower and the Louvre Museum. The city was beautiful, but there were a lot of tourists.",
    vocabulary: [
      { word: "voyage", phonetic: "/vwa.jaʒ/", translation: "trip" },
      { word: "amis", phonetic: "/a.mi/", translation: "friends" },
      { word: "magnifique", phonetic: "/ma.ɲi.fik/", translation: "magnificent" },
      { word: "touristes", phonetic: "/tu.ʁist/", translation: "tourists" }
    ]
  },
  {
    id: 7,
    language: 'french',
    title: "Au restaurant",
    level: "A2",
    content: "Hier soir, j'ai dîné dans un restaurant français. J'ai commandé une soupe à l'oignon et un steak-frites. Pour le dessert, j'ai pris une mousse au chocolat. C'était délicieux.",
    translation: "Last night, I had dinner at a French restaurant. I ordered onion soup and steak with fries. For dessert, I had a chocolate mousse. It was delicious.",
    vocabulary: [
      { word: "restaurant", phonetic: "/ʁɛs.tɔ.ʁɑ̃/", translation: "restaurant" },
      { word: "oignon", phonetic: "/ɔ.ɲɔ̃/", translation: "onion" },
      { word: "délicieux", phonetic: "/de.li.sjø/", translation: "delicious" },
      { word: "dessert", phonetic: "/de.sɛʁ/", translation: "dessert" }
    ]
  },
  {
    id: 8,
    language: 'french',
    title: "Mon nouvel appartement",
    level: "A2",
    content: "Je viens de déménager dans un nouvel appartement. Il est situé au centre-ville. Il est petit mais très lumineux. J'ai passé tout le week-end à peindre les murs en blanc.",
    translation: "I just moved into a new apartment. It is located in the city center. It is small but very bright. I spent the whole weekend painting the walls white.",
    vocabulary: [
      { word: "déménager", phonetic: "/de.me.na.ʒe/", translation: "to move" },
      { word: "situé", phonetic: "/si.tɥe/", translation: "located" },
      { word: "lumineux", phonetic: "/ly.mi.nø/", translation: "bright" },
      { word: "peindre", phonetic: "/pɛ̃dʁ/", translation: "to paint" }
    ]
  },
  {
    id: 9,
    language: 'french',
    title: "Faire du sport",
    level: "A2",
    content: "Pour rester en forme, je cours deux fois par semaine. Parfois, je vais à la piscine le mercredi. Le sport m'aide à me détendre après une longue journée de travail.",
    translation: "To stay in shape, I run twice a week. Sometimes, I go to the swimming pool on Wednesdays. Sport helps me relax after a long day of work.",
    vocabulary: [
      { word: "forme", phonetic: "/fɔʁm/", translation: "shape/fitness" },
      { word: "piscine", phonetic: "/pi.sin/", translation: "pool" },
      { word: "détendre", phonetic: "/de.tɑ̃dʁ/", translation: "to relax" },
      { word: "longue", phonetic: "/lɔ̃ɡ/", translation: "long" }
    ]
  },
  {
    id: 10,
    language: 'french',
    title: "Projets d'avenir",
    level: "A2",
    content: "L'année prochaine, je voudrais apprendre l'espagnol. Je rêve aussi de voyager en Amérique du Sud. Il faut que j'économise de l'argent pour réaliser ce rêve.",
    translation: "Next year, I would like to learn Spanish. I also dream of traveling to South America. I need to save money to make this dream come true.",
    vocabulary: [
      { word: "année", phonetic: "/a.ne/", translation: "year" },
      { word: "voyager", phonetic: "/vwa.ja.ʒe/", translation: "to travel" },
      { word: "économiser", phonetic: "/e.kɔ.nɔ.mi.ze/", translation: "to save money" },
      { word: "réaliser", phonetic: "/ʁe.a.li.ze/", translation: "to realize" }
    ]
  },

  // --- JAPANESE STORIES ---
  {
    id: 11,
    language: 'japanese',
    title: "自己紹介 (Self Introduction)",
    level: "N5",
    content: "はじめまして。田中です。東京に住んでいます。趣味は読書です。週末は図書館に行きます。日本語の勉強は楽しいです。よろしくお願いします。",
    translation: "Nice to meet you. I am Tanaka. I live in Tokyo. My hobby is reading. I go to the library on weekends. Studying Japanese is fun. Nice to meet you.",
    vocabulary: [
      { word: "はじめまして", phonetic: "Hajimemashite", translation: "Nice to meet you" },
      { word: "趣味", phonetic: "Shumi", translation: "Hobby" },
      { word: "図書館", phonetic: "Toshokan", translation: "Library" },
      { word: "勉強", phonetic: "Benkyō", translation: "Study" }
    ]
  },
  {
    id: 12,
    language: 'japanese',
    title: "私の一日 (My Day)",
    level: "N5",
    content: "毎朝七時に起きます。パンを食べて、電車で会社に行きます。仕事は九時から五時までです。夜は家でテレビを見ます。十一時に寝ます。",
    translation: "I wake up at seven every morning. I eat bread and go to work by train. Work is from nine to five. In the evening, I watch TV at home. I sleep at eleven.",
    vocabulary: [
      { word: "起きます", phonetic: "Okimasu", translation: "Wake up" },
      { word: "会社", phonetic: "Kaisha", translation: "Company" },
      { word: "電車", phonetic: "Densha", translation: "Train" },
      { word: "寝ます", phonetic: "Nemasu", translation: "Sleep" }
    ]
  },
  {
    id: 13,
    language: 'japanese',
    title: "新しい友達 (New Friend)",
    level: "N5",
    content: "昨日、新しい友達ができました。ジョンさんです。カフェでコーヒーを飲みました。彼は日本の文化が好きです。来週、浅草に行きます。楽しみです。",
    translation: "Yesterday, I made a new friend. It's John. We drank coffee at a cafe. He likes Japanese culture. Next week, we are going to Asakusa. I'm looking forward to it.",
    vocabulary: [
      { word: "友達", phonetic: "Tomodachi", translation: "Friend" },
      { word: "文化", phonetic: "Bunka", translation: "Culture" },
      { word: "来週", phonetic: "Raishū", translation: "Next week" },
      { word: "楽しみ", phonetic: "Tanoshimi", translation: "Excited/Looking forward" }
    ]
  },
  {
    id: 14,
    language: 'japanese',
    title: "週末の旅行 (Weekend Trip)",
    level: "N4",
    content: "週末、家族と温泉に行きました。山はとてもきれいでした。旅館でおいしい和食を食べました。温泉に入って、リラックスしました。いい思い出です。",
    translation: "On the weekend, I went to a hot spring with my family. The mountains were very beautiful. We ate delicious Japanese food at the inn. We entered the hot spring and relaxed. It is a good memory.",
    vocabulary: [
      { word: "温泉", phonetic: "Onsen", translation: "Hot spring" },
      { word: "旅館", phonetic: "Ryokan", translation: "Japanese inn" },
      { word: "和食", phonetic: "Washoku", translation: "Japanese food" },
      { word: "思い出", phonetic: "Omoide", translation: "Memory" }
    ]
  },
  {
    id: 15,
    language: 'japanese',
    title: "日本の夏 (Japanese Summer)",
    level: "N4",
    content: "日本の夏は暑いです。でも、花火大会があります。浴衣を着て、花火を見ます。とてもきれいです。夏休みは海に行きたいです。夏は楽しいです。",
    translation: "Summer in Japan is hot. But there are fireworks festivals. I wear a yukata and watch fireworks. It is very beautiful. I want to go to the sea during summer vacation. Summer is fun.",
    vocabulary: [
      { word: "暑い", phonetic: "Atsui", translation: "Hot" },
      { word: "花火", phonetic: "Hanabi", translation: "Fireworks" },
      { word: "浴衣", phonetic: "Yukata", translation: "Yukata (summer kimono)" },
      { word: "海", phonetic: "Umi", translation: "Sea" }
    ]
  },
  {
    id: 16,
    language: 'japanese',
    title: "日本の四季 (The Four Seasons of Japan)",
    level: "N4",
    content: "日本には四季があります。春は桜が咲いて、とてもきれいです。夏は蒸し暑いですが、お祭りや花火大会がたくさんあります。秋は紅葉が美しく、ハイキングに行く人が多いです。冬は雪が降る地域もあり、スキーやスノーボードを楽しむことができます。それぞれの季節に特別な食べ物や行事があるので、一年中楽しむことができます。私は特に、涼しくて景色がきれいな秋が一番好きです。",
    translation: "Japan has four seasons. In spring, cherry blossoms bloom and it is very beautiful. Summer is hot and humid, but there are many festivals and fireworks displays. In autumn, the autumn leaves are beautiful, and many people go hiking. In winter, it snows in some regions, and you can enjoy skiing and snowboarding. There are special foods and events for each season, so you can enjoy it all year round. I especially like autumn the best because it is cool and the scenery is beautiful.",
    vocabulary: [
      { word: "四季", phonetic: "Shiki", translation: "Four seasons" },
      { word: "蒸し暑い", phonetic: "Mushiatsui", translation: "Hot and humid" },
      { word: "紅葉", phonetic: "Kōyō", translation: "Autumn leaves" },
      { word: "行事", phonetic: "Gyōji", translation: "Event/Ritual" }
    ]
  },
  {
    id: 17,
    language: 'japanese',
    title: "健康な生活 (Healthy Life)",
    level: "N4",
    content: "最近、健康のために毎日三十分歩くようにしています。以前は全然運動をしていませんでしたが、歩き始めてから体が軽くなった気がします。また、食事にも気をつけています。野菜をたくさん食べて、甘いものを控えるようにしています。夜は早く寝て、十分な睡眠をとることも大切です。健康でいると、仕事や勉強もはかどります。これからも、この習慣を続けていきたいと思っています。皆さんは、健康のために何かしていますか。",
    translation: "Recently, I have been trying to walk for thirty minutes every day for my health. I used to not exercise at all, but since I started walking, I feel like my body has become lighter. Also, I am careful about my diet. I try to eat a lot of vegetables and cut back on sweets. It is also important to go to bed early at night and get enough sleep. When you are healthy, your work and studies progress well. I want to continue this habit from now on. Is there anything you all do for your health?",
    vocabulary: [
      { word: "健康", phonetic: "Kenkō", translation: "Health" },
      { word: "運動", phonetic: "Undō", translation: "Exercise" },
      { word: "睡眠", phonetic: "Suimin", translation: "Sleep" },
      { word: "習慣", phonetic: "Shūkan", translation: "Habit" }
    ]
  },
  {
    id: 18,
    language: 'japanese',
    title: "将来の夢 (Future Dream)",
    level: "N3",
    content: "私の将来の夢は、海外で日本語を教えることです。大学生の時にボランティアで外国人に日本語を教えたことがきっかけで、この仕事に興味を持ちました。言葉を教えるだけでなく、日本の文化や考え方も伝えたいと思っています。そのために、今は日本語教育の資格を取るために一生懸命勉強しています。また、英語ももっと上手に話せるようになりたいです。いつか自分の教室を持って、世界中の人たちと交流するのが目標です。夢を実現させるのは大変ですが、諦めずに頑張ります。",
    translation: "My future dream is to teach Japanese abroad. I became interested in this job after volunteering to teach Japanese to foreigners when I was a university student. I want to convey not only the language but also Japanese culture and ways of thinking. For that purpose, I am studying hard now to get a qualification in Japanese language education. Also, I want to be able to speak English better. My goal is to have my own classroom someday and interact with people from all over the world. It is difficult to make a dream come true, but I will do my best without giving up.",
    vocabulary: [
      { word: "将来", phonetic: "Shōrai", translation: "Future" },
      { word: "興味", phonetic: "Kyōmi", translation: "Interest" },
      { word: "資格", phonetic: "Shikaku", translation: "Qualification" },
      { word: "実現", phonetic: "Jitsugen", translation: "Realization" }
    ]
  },
  {
    id: 19,
    language: 'japanese',
    title: "日本のコンビニ (Japanese Convenience Stores)",
    level: "N3",
    content: "日本のコンビニはとても便利で、どこにでもあります。二十四時間営業なので、夜遅くても買い物ができます。お弁当やおにぎり、飲み物だけでなく、日用品も売っています。また、公共料金の支払いや荷物の発送もできるので、生活に欠かせない存在です。最近のコンビニスイーツはクオリティが高く、専門店にも負けないほど美味しいと評判です。外国人観光客にとっても、日本のコンビニは驚きと発見がある場所のようです。私も、新しい商品が出るのをいつも楽しみにしています。",
    translation: "Japanese convenience stores are very convenient and are everywhere. Since they are open 24 hours a day, you can shop even late at night. They sell not only lunch boxes, rice balls, and drinks, but also daily necessities. Also, you can pay utility bills and send packages, so they are an indispensable presence in daily life. Recent convenience store sweets have high quality and are rumored to be as delicious as those from specialty stores. For foreign tourists, Japanese convenience stores seem to be a place of surprise and discovery. I also always look forward to new products coming out.",
    vocabulary: [
      { word: "便利", phonetic: "Benri", translation: "Convenient" },
      { word: "営業", phonetic: "Eigyō", translation: "Business/Operation" },
      { word: "欠かせない", phonetic: "Kakasenai", translation: "Indispensable" },
      { word: "評判", phonetic: "Hyōban", translation: "Reputation" }
    ]
  },
  {
    id: 20,
    language: 'japanese',
    title: "環境問題について (About Environmental Issues)",
    level: "N3",
    content: "地球温暖化などの環境問題は、私たちにとって深刻な課題です。最近、世界中で異常気象が増えており、私たちの生活に大きな影響を与えています。環境を守るために、一人一人ができることから始めることが大切です。例えば、プラスチックごみを減らすためにマイバッグを持ち歩いたり、電気をこまめに消したりすることです。また、リサイクルを徹底することも効果的です。小さなことの積み重ねが、未来の地球を守ることにつながります。私たちは、次の世代に美しい自然を残す責任があるのではないでしょうか。",
    translation: "Environmental issues such as global warming are serious challenges for us. Recently, abnormal weather has been increasing all over the world, having a major impact on our lives. To protect the environment, it is important for each individual to start with what they can do. For example, carrying a reusable bag to reduce plastic waste or turning off lights frequently. Also, being thorough with recycling is effective. The accumulation of small things leads to protecting the future of the Earth. Don't we have a responsibility to leave beautiful nature for the next generation?",
    vocabulary: [
      { word: "環境", phonetic: "Kankō", translation: "Environment" },
      { word: "深刻", phonetic: "Shinkoku", translation: "Serious" },
      { word: "影響", phonetic: "Eikyō", translation: "Influence/Impact" },
      { word: "責任", phonetic: "Sekinin", translation: "Responsibility" }
    ]
  }
];
