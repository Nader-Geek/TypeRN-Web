# Auto-place: Manga-AutoTranslate → TypeR Web

1. في Manga-AutoTranslate: `python manga.py -i pages -o out.pdf --clean-only --export-typer job --provider ollama ...`
   (ينتج `job/` و`job.zip` فيها صفحات منظّفة `page_NNN.png` + `typer_job.json` بإحداثيات الفقاعات).
   لو تريد الترجمة التلقائية احذف `--clean-only`؛ النصوص تُحفظ في الـjob.
2. في TypeR Web: **File ▸ Auto-place from Manga-AutoTranslate…** ثم اختر `job.zip` والصق السكربت
   (`Page 1` / `"": …` / `(): …` / `//: …` / `OT: …`، والأسطر المتصلة تُدمج في فقاعة واحدة) أو اتركه فارغاً لاستخدام ترجمة الـjob.
3. يُنشئ TypeR طبقة نص قابلة للتعديل في كل فقاعة (Smart Paste + TextShapeR) وتكمل أنت التنسيق.

ملاحظات: ربط الأسطر بالفقاعات بترتيب القراءة؛ أسطر `OT` تذهب لمناطق النص الحر أولاً. الزائد في أي طرف يُذكر في الملخص.
البادئات (`()`, `""`…) يعالجها نمط TypeR عندك (prefixes في الـstyle) — لا تُحذف تلقائياً.
عليك تفعيل Smart Paste/لصق عند النقر في اللوحة وتحميل خط عربي (Vazirmatn/Cairo).

## الكشف التلقائي (بدون Manga-AutoTranslate)
في نفس النافذة: اختر **صور الصفحات** مباشرة (بدل job.zip) واختر ملف موديل الكشف مرة واحدة (`detector-v4-s_int8.onnx` ~11MB من
https://github.com/amirwolf5122/Manga-AutoTranslate/releases/tag/models) — يُحفظ في المتصفح. يستخدم نفس موديل ومنطق Manga-AutoTranslate
(onnxruntime-web)، بلا OCR ولا تبييض: النص يُوضع فوق الصفحة الأصلية وTypeR يحدد الفقاعة من ورقتها.
قياس أولي (صفحة حقيقية 2210×3003، CPU في بيئة اختبار، نسخة int8): كشف ≈3 ث/صفحة، كتابة ≈1 ث لكل نص.
