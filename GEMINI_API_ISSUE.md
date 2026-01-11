# Gemini AI API সমস্যা সমাধান গাইড

## সমস্যা
Gemini API থেকে 404 Not Found error আসছে বিভিন্ন model name-এর জন্য।

## চেষ্টা করা Model Names (সব 404 দিয়েছে)
- `gemini-pro`
- `gemini-1.5-flash`
- `gemini-1.0-pro`
- `gemini-1.5-flash-latest`
- `gemini-2.0-flash`
- `models/gemini-1.5-flash`

## সম্ভাব্য কারণসমূহ

### ১. API Key সমস্যা
আপনার `GEMINI_API_KEY` হয়তো:
- Expired হয়ে গেছে
- Insufficient permissions আছে
- Wrong project থেকে নেওয়া হয়েছে

### ২. Model Access Issue
- আপনার Google Cloud project-এ Gemini models access নাও থাকতে পারে
- Region restrictions থাকতে পারে

### ৩. Deprecated Models
- January 2026 পর্যন্ত কিছু model version retire হয়ে গেছে

## সমাধান পদক্ষেপ

### Option 1: নতুন API Key নিন
1. https://aistudio.google.com/app/apikey তে যান
2. নতুন API key create করুন
3. `.env` ফাইলে update করুন

### Option 2: Available Models চেক করুন
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
```

এটি আপনার available models দেখাবে।

### Option 3: AI ছাড়াই চালান (বর্তমান কনফিগারেশন)
সিস্টেম ইতিমধ্যে AI unavailability handle করার জন্য configured:
- টেকনিক্যাল অ্যানালাইসিস-ভিত্তিক সিগন্যাল (75/100 score)
- কোনো crash নেই
- সকল functionality কাজ করছে

## বর্তমান অবস্থা
✅ **System is working** - AI fallback mode-এ চলছে  
⚠️ **AI Scoring unavailable** - টেকনিক্যাল scoring ব্যবহার হচ্ছে

আপনি যদি AI scoring চান, তবে নতুন valid API key প্রয়োজন হবে।
