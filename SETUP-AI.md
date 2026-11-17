# AI ওস্তাদ চালু করা: ফ্রি, ঘণ্টায় সীমাসহ

ফ্রি চ্যাটবটের মতো: প্রত্যেক ব্যবহারকারী (ডিভাইস) ঘণ্টায় নির্দিষ্ট কয়েকটি প্রশ্ন করতে পারবে, সীমা শেষ হলে "কত মিনিট পর আবার" বলে দেবে।

কেন সরাসরি অ্যাপে নয়: API কী অ্যাপ বা GitHub-এ রাখলে যে কেউ দেখে ফেলতে পারে। তাই কী থাকে একটি ছোট প্রক্সিতে (Cloudflare Worker, ফ্রি), অ্যাপ শুধু ওই ঠিকানায় প্রশ্ন পাঠায়।

## ১. ফ্রি AI কী (Google Gemini)
1. aistudio.google.com এ Google অ্যাকাউন্টে ঢুকে **Get API key** চাপুন, কী বানান ও কপি করুন।
2. ফ্রি টায়ারের সীমা মডেল ও অ্যাকাউন্ট অনুযায়ী বদলায় এবং **পুরো প্রজেক্টের জন্য একসাথে** গোনা হয় (সব ব্যবহারকারী মিলে)। আপনার সীমা AI Studio-তে দেখুন।
(Claude API ফ্রি নয়। সেটি চাইলে console.anthropic.com থেকে কী নিয়ে ধাপ ৩-এ `GEMINI_API_KEY`-র বদলে `ANTHROPIC_API_KEY` দিন।)

## ২. Cloudflare Worker বানান
1. dash.cloudflare.com এ ফ্রি অ্যাকাউন্ট খুলুন।
2. **Workers & Pages → Create → Create Worker**, নাম `arabi-tutor`, **Deploy**।
3. **Edit code** চেপে সব কোড মুছে `tutor-worker.js` এর পুরো লেখা পেস্ট করুন, **Deploy**।

## ৩. সেটিং
Worker → **Settings → Variables and Secrets**:
| নাম | ধরন | মান |
|---|---|---|
| GEMINI_API_KEY | Secret | ধাপ ১-এর কী |
| ALLOWED_ORIGINS | Text | https://lotuspro57.github.io,https://localhost |
| HOURLY_LIMIT | Text | 10 (প্রতি ডিভাইসে ঘণ্টায় ১০টি প্রশ্ন; ইচ্ছামতো বদলান) |

## ৪. ঘণ্টার সীমা গোনার জন্য KV
1. Cloudflare → **Storage & Databases → KV → Create** নাম `arabi-rate`।
2. Worker → **Settings → Bindings → Add → KV namespace**, Variable name: `RATE`, namespace: `arabi-rate` → Deploy।
(KV না দিলে সীমা কাজ করবে না, প্রশ্ন অসীম চলবে। ফ্রি KV-তে দিনে প্রায় ১০০০ লেখা চলে, অর্থাৎ দিনে প্রায় ১০০০ প্রশ্ন।)

## ৫. অ্যাপের সঙ্গে যোগ
Worker-এর ঠিকানা (https://arabi-tutor.<আপনার-নাম>.workers.dev) কপি করে GitHub-এ `version.json`-এ বসান:
```
"tutorEndpoint": "https://arabi-tutor.<আপনার-নাম>.workers.dev"
```
Commit করুন। ওয়েব অ্যাপ ও APK দুটোতেই AI ওস্তাদ চালু হবে, নতুন APK লাগবে না।

## জেনে রাখুন
- সীমা ডিভাইস ধরে। কেউ অ্যাপের ডেটা মুছে ফেললে নতুন ডিভাইস গণ্য হবে। সবার জন্য মোট সীমা Gemini নিজেই বসায়; বেশি ভিড় হলে ব্যবহারকারী "এখন অনেকেই প্রশ্ন করছে, এক মিনিট পর চেষ্টা করুন" বার্তা পাবে।
- মডেলের নাম বদলাতে চাইলে Worker-এর `MODEL` ভ্যারিয়েবলে দিন (ডিফল্ট `gemini-2.5-flash`)। গুগল পুরোনো মডেল বন্ধ করলে এটি বদলাতে হবে।
- অন্য AI (OpenAI, Groq) চাইলে `tutor-worker.js`-এর শুধু API ডাকার অংশ বদলাতে হয়; অ্যাপের দিক একই থাকে।
