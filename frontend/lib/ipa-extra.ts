// Video: 3 YouTube videos embedded in the ZIM article below (one per sound group).
export const SOURCE_URL = "https://zim.vn/bang-phien-am-tieng-anh-ipa-va-cach-phat-am-day-du";
export const GROUP_VIDEOS = { vowel: "M0O_5H4A6l8", diphthong: "2hJOOnFwiRM", consonant: "I-4DG6DL8ZA" } as const;

// Values are Vietnamese keys that go through t().
export const CATEGORY: Record<string, string> = {
  "short vowel": "Nguyên âm ngắn", "long vowel": "Nguyên âm dài",
  "closing diphthong": "Nguyên âm đôi khép", "centring diphthong": "Nguyên âm đôi hướng tâm",
  plosive: "Âm bật", affricate: "Âm tắc xát", fricative: "Âm xát", nasal: "Âm mũi", approximant: "Âm tiếp cận",
};

type Tip = { vi: string; en: string };
const tip = (vi: string, en: string): Tip => ({ vi, en });

// Pronunciation notes written for this app (mouth / tongue / voicing), based on standard phonetics.
export const TIPS: Record<string, Tip> = {
  "ɪ": tip("Môi mở nhẹ sang hai bên, lưỡi thấp và thả lỏng. Ngắn và lỏng hơn 'i' tiếng Việt.", "Lips slightly spread, tongue low and relaxed. Shorter and looser than the 'ee' in 'see'."),
  "iː": tip("Môi kéo sang hai bên như đang cười, lưỡi nâng cao. Kéo dài âm.", "Lips spread as in a smile, tongue raised high. Hold the sound longer."),
  "e": tip("Miệng mở hơn /ɪ/ một chút, lưỡi hạ thấp. Giống 'e' tiếng Việt nhưng ngắn.", "Mouth a little more open than /ɪ/, tongue lower. Like a short Vietnamese 'e'."),
  "æ": tip("Mở miệng rộng, hàm dưới hạ thấp, lưỡi thấp. Âm nằm giữa 'a' và 'e'.", "Open the mouth wide, jaw down, tongue low. A sound between 'a' and 'e'."),
  "ʌ": tip("Miệng mở vừa, lưỡi hơi nâng. Gần giống 'ă', bật hơi ngắn.", "Mouth half open, tongue slightly raised. A short 'uh', close to Vietnamese 'ă'."),
  "ʊ": tip("Môi tròn nhẹ, lưỡi thấp và lùi. Ngắn, không chu môi mạnh như /uː/.", "Lips lightly rounded, tongue low and back. Short, without the strong lip rounding of /uː/."),
  "uː": tip("Môi tròn và chu về trước, cuống lưỡi nâng cao. Kéo dài âm.", "Lips rounded and pushed forward, back of the tongue high. Hold it long."),
  "ɒ": tip("Môi hơi tròn, miệng mở, lưỡi thấp. Giống 'o' ngắn (Anh-Anh).", "Lips slightly rounded, mouth open, tongue low. A short 'o' (British)."),
  "ɔː": tip("Môi tròn hơn /ɒ/, cuống lưỡi nâng một chút. Kéo dài âm.", "Lips rounder than /ɒ/, back of the tongue a little higher. Hold it long."),
  "ɑː": tip("Miệng mở rộng, lưỡi thấp và lùi. 'a' kéo dài, phát từ sâu trong miệng.", "Mouth wide open, tongue low and back. A long 'ah' from deep in the mouth."),
  "ɜː": tip("Môi thả lỏng, lưỡi ở giữa miệng. Giống 'ơ' kéo dài (giọng Anh-Anh không cuộn lưỡi).", "Lips relaxed, tongue in the middle. A long 'er' (no tongue curl in British English)."),
  "ə": tip("Âm yếu nhất: miệng thả lỏng hoàn toàn, rất ngắn. Hay gặp ở âm tiết không nhấn.", "The weakest vowel: fully relaxed and very short. Common in unstressed syllables."),
  "eɪ": tip("Bắt đầu từ /e/ rồi trượt lên /ɪ/, môi dẹt dần.", "Start at /e/ and glide up to /ɪ/, lips flattening gradually."),
  "aɪ": tip("Bắt đầu từ /a/ mở rộng rồi trượt lên /ɪ/.", "Start with an open /a/ and glide up to /ɪ/."),
  "ɔɪ": tip("Bắt đầu từ /ɔː/ tròn môi rồi trượt sang /ɪ/.", "Start with a rounded /ɔː/ and glide to /ɪ/."),
  "əʊ": tip("Bắt đầu từ /ə/ rồi tròn môi dần sang /ʊ/.", "Start at /ə/ and round the lips gradually towards /ʊ/."),
  "aʊ": tip("Bắt đầu từ /a/ mở rộng rồi tròn môi dần sang /ʊ/.", "Start with an open /a/ and round the lips towards /ʊ/."),
  "ɪə": tip("Bắt đầu từ /ɪ/ rồi trượt về /ə/ thả lỏng.", "Start at /ɪ/ and glide to a relaxed /ə/."),
  "eə": tip("Bắt đầu từ /e/ rồi trượt về /ə/.", "Start at /e/ and glide to /ə/."),
  "ʊə": tip("Bắt đầu từ /ʊ/ tròn môi rồi trượt về /ə/.", "Start at a rounded /ʊ/ and glide to /ə/."),
  "p": tip("Hai môi khép chặt rồi bật hơi mạnh ra. Không rung dây thanh.", "Close both lips, then release a strong puff of air. Voiceless."),
  "b": tip("Giống /p/ nhưng có rung dây thanh, gần giống 'b' tiếng Việt.", "Like /p/ but voiced, close to Vietnamese 'b'."),
  "t": tip("Đầu lưỡi chạm lợi trên rồi bật hơi. Không rung dây thanh.", "Tongue tip touches the ridge behind the upper teeth, then releases air. Voiceless."),
  "d": tip("Giống /t/ nhưng có rung dây thanh.", "Like /t/ but voiced."),
  "k": tip("Cuống lưỡi chạm ngạc mềm rồi bật hơi. Không rung dây thanh.", "Back of the tongue touches the soft palate, then releases air. Voiceless."),
  "ɡ": tip("Giống /k/ nhưng có rung dây thanh.", "Like /k/ but voiced."),
  "tʃ": tip("Giống 'ch': môi hơi chu, lưỡi chạm lợi rồi bật ra. Không rung.", "Like 'ch': lips slightly rounded, tongue touches the ridge then releases. Voiceless."),
  "dʒ": tip("Giống /tʃ/ nhưng có rung dây thanh (như 'j' trong 'job').", "Like /tʃ/ but voiced (the 'j' in 'job')."),
  "f": tip("Răng trên chạm nhẹ môi dưới, thổi hơi ra. Giống 'ph'.", "Upper teeth lightly touch the lower lip, blow air out. Like Vietnamese 'ph'."),
  "v": tip("Giống /f/ nhưng có rung dây thanh, như 'v'.", "Like /f/ but voiced, like 'v'."),
  "θ": tip("Đặt đầu lưỡi giữa hai hàm răng và thổi hơi. Không rung. Lỗi hay gặp: đọc thành /t/ hoặc /s/.", "Put the tongue tip between the teeth and blow air. Voiceless. Common mistake: saying /t/ or /s/."),
  "ð": tip("Vị trí như /θ/ nhưng có rung dây thanh. Lỗi hay gặp: đọc thành /d/ hoặc /z/.", "Same position as /θ/ but voiced. Common mistake: saying /d/ or /z/."),
  "s": tip("Lưỡi gần lợi trên, để khí thoát qua khe hẹp. Không rung.", "Tongue close to the upper ridge, air escapes through a narrow gap. Voiceless."),
  "z": tip("Giống /s/ nhưng có rung dây thanh.", "Like /s/ but voiced."),
  "ʃ": tip("Chu môi, nâng phần trước lưỡi, thổi hơi. Giống 'sh'. Không rung.", "Round the lips, raise the front of the tongue, blow air. Like 'sh'. Voiceless."),
  "ʒ": tip("Giống /ʃ/ nhưng có rung dây thanh (như 's' trong 'vision').", "Like /ʃ/ but voiced (the 's' in 'vision')."),
  "h": tip("Thở hơi nhẹ từ cổ họng, miệng hé, không rung.", "A light breath from the throat, mouth slightly open, voiceless."),
  "m": tip("Hai môi khép, hơi thoát ra qua mũi, có rung.", "Lips closed, air passes through the nose, voiced."),
  "n": tip("Đầu lưỡi chạm lợi trên, hơi thoát qua mũi, có rung.", "Tongue tip on the upper ridge, air through the nose, voiced."),
  "ŋ": tip("Cuống lưỡi chạm ngạc mềm, hơi thoát qua mũi. Như 'ng' cuối từ 'sing'.", "Back of the tongue on the soft palate, air through the nose. Like the 'ng' in 'sing'."),
  "l": tip("Đầu lưỡi chạm lợi trên, hơi thoát hai bên lưỡi, có rung.", "Tongue tip on the upper ridge, air flows along the sides, voiced."),
  "r": tip("Cuộn nhẹ lưỡi về sau, KHÔNG chạm vòm miệng, môi hơi tròn. Khác 'r' tiếng Việt.", "Curl the tongue back slightly without touching the roof of the mouth, lips a bit rounded."),
  "w": tip("Môi tròn và chu ra trước, rồi mở nhanh sang nguyên âm sau.", "Round and push the lips forward, then open quickly into the next vowel."),
  "j": tip("Nâng phần trước lưỡi gần ngạc cứng rồi trượt sang nguyên âm. Giống 'y'.", "Raise the front of the tongue near the hard palate and glide into the vowel. Like 'y'."),
};
