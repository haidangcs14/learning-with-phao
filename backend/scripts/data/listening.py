"""Bài nghe theo cấp độ (nội dung tự biên soạn). Trình duyệt đọc bằng giọng tổng hợp (Web Speech API), nên không cần file audio."""
import re


def L(title, level, topic, lines, questions):
    text = " ".join(t for _, t in lines)
    return {
        "kind": "listening", "title": title, "slug": re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-"),
        "level": level, "topic": topic, "script": [{"speaker": s, "text": t} for s, t in lines], "vocabulary": [],
        "questions": [{"q": q, "options": o, "answer": a} for q, o, a in questions],
        "word_count": len(re.findall(r"[A-Za-z']+", text)), "question_count": len(questions),
    }


LISTENING = [
    L("Introducing Myself", "A1", "About me",
      [(None, "Hello. My name is Ken. I am from Canada. I am a student. I study English and music."), (None, "I have one sister. Her name is Anna. She is fifteen. We live in a small house near a park.")],
      [("Where is Ken from?", ["Australia", "Canada", "England", "America"], 1), ("What does Ken study?", ["Maths and art", "English and music", "History", "Science"], 1),
       ("How old is Anna?", ["Ten", "Twelve", "Fifteen", "Eighteen"], 2)]),
    L("At the Shop", "A1", "Shopping",
      [("Shopkeeper", "Hello. Can I help you?"), ("Customer", "Yes, please. I want some apples."), ("Shopkeeper", "How many?"),
       ("Customer", "Six, please. And a bottle of milk."), ("Shopkeeper", "That is four dollars."), ("Customer", "Here you are. Thank you."), ("Shopkeeper", "Have a nice day!")],
      [("What does the customer want?", ["Oranges and bread", "Apples and milk", "Bananas and water", "Rice and eggs"], 1), ("How many apples?", ["Four", "Five", "Six", "Seven"], 2),
       ("How much is it?", ["Two dollars", "Four dollars", "Six dollars", "Ten dollars"], 1)]),

    L("Weekend Plans", "A2", "Plans",
      [("Sara", "What are you doing this weekend, Ben?"), ("Ben", "On Saturday I'm visiting my grandparents. They live in the countryside."),
       ("Sara", "That sounds nice. Are you going by train?"), ("Ben", "No, my dad is driving us. It takes about two hours."), ("Sara", "And on Sunday?"),
       ("Ben", "I'm playing football with my friends in the afternoon. Why don't you join us?"), ("Sara", "I'd love to, but I have to study for a test. Maybe next time.")],
      [("Where do Ben's grandparents live?", ["In the city", "In the countryside", "By the sea", "Abroad"], 1), ("How are they travelling?", ["By train", "By bus", "By car", "By plane"], 2),
       ("Why can't Sara join Ben on Sunday?", ["She is ill", "She is travelling", "She has to study", "She dislikes football"], 2)]),
    L("Weather Report", "A2", "Weather",
      [(None, "Good morning. Here is the weather for today. This morning it will be cloudy in the north, with some light rain after ten o'clock. In the south, it will be sunny and warm, with temperatures up to thirty degrees."),
       (None, "In the afternoon, strong winds are expected along the coast, so please be careful if you are going to the beach. Tomorrow will be cooler and dry everywhere.")],
      [("What will the weather be like in the south?", ["Rainy", "Sunny and warm", "Snowy", "Foggy"], 1), ("What is expected along the coast in the afternoon?", ["Strong winds", "Thunderstorms", "Heavy snow", "Fog"], 0),
       ("How will tomorrow be?", ["Hotter and wetter", "Cooler and dry", "Stormy", "The same as today"], 1)]),

    L("Job Interview", "B1", "Work",
      [("Interviewer", "Thank you for coming, Ms Nguyen. Could you tell me why you want this job?"),
       ("Ms Nguyen", "I have worked as a sales assistant for three years, and I'd like to move into customer service because I enjoy helping people."),
       ("Interviewer", "What would you say is your greatest strength?"), ("Ms Nguyen", "I'm very organised, and I stay calm under pressure."),
       ("Interviewer", "Good. Are you able to start next month?"), ("Ms Nguyen", "Yes, I only need to give two weeks' notice to my current employer.")],
      [("What is Ms Nguyen's current job?", ["Teacher", "Sales assistant", "Manager", "Receptionist"], 1), ("Why does she want to change?", ["Better salary", "She dislikes shopping", "She enjoys helping people", "Shorter hours"], 2),
       ("What is her strength?", ["Languages", "Being organised and calm", "Computer skills", "Driving"], 1), ("How much notice must she give?", ["One week", "Two weeks", "One month", "None"], 1)]),
    L("Lost Luggage", "B1", "Travelling",
      [("Passenger", "Excuse me, my suitcase didn't arrive on the carousel."), ("Agent", "I'm sorry to hear that. Can you describe it?"),
       ("Passenger", "It's a large blue suitcase with a red ribbon on the handle."), ("Agent", "And what flight were you on?"), ("Passenger", "Flight 215 from Singapore."),
       ("Agent", "Please fill in this form. We'll call you as soon as we find it, usually within twenty-four hours, and deliver it to your hotel."), ("Passenger", "Thank you. I'm staying at the Lotus Hotel.")],
      [("What is the problem?", ["A missed flight", "A lost suitcase", "A late flight", "A broken bag"], 1), ("What does the suitcase look like?", ["Small and black", "Large and blue with a red ribbon", "Medium and green", "Large and red"], 1),
       ("What will the agent do?", ["Give a refund", "Deliver it to the hotel when found", "Book another flight", "Call the police"], 1)]),

    L("A Talk About Sleep", "B2", "Health",
      [(None, "Good evening everyone. Tonight I'd like to talk about why sleep matters more than most people think. Adults generally need between seven and nine hours a night, yet surveys suggest that nearly a third of us regularly get less than six."),
       (None, "The consequences go beyond feeling tired. Lack of sleep weakens the immune system, affects our ability to concentrate, and even increases the risk of heart disease over time."),
       (None, "One practical tip is to keep a regular schedule, going to bed and waking up at roughly the same time every day, including weekends. It is also wise to avoid screens for an hour before bed, as the light they emit can delay the release of the hormone that makes us sleepy.")],
      [("How much sleep do adults generally need?", ["Five to six hours", "Six to seven hours", "Seven to nine hours", "Nine to eleven hours"], 2), ("What is one consequence of too little sleep?", ["Stronger immunity", "Higher risk of heart disease", "Better concentration", "Faster growth"], 1),
       ("What does the speaker advise?", ["Sleeping late on weekends", "A regular sleeping schedule", "Using screens in bed", "Drinking coffee at night"], 1), ("Why avoid screens before bed?", ["They are expensive", "Their light delays a sleep hormone", "They make noise", "They cause headaches"], 1)]),

    L("Cycling in the City", "C1", "Environment",
      [("Host", "With us today is Dr Hale, an urban planner. Dr Hale, why are so many cities investing in cycle lanes?"),
       ("Dr Hale", "Mainly because the evidence is compelling. When a city builds protected lanes, cycling rises sharply, which reduces congestion and improves air quality. Critics argue that the lanes take space from drivers, but studies show that journey times often change very little."),
       ("Host", "Isn't there a safety concern, though?"),
       ("Dr Hale", "There is, which is precisely why protection matters. Painted lines alone offer little reassurance; physical barriers are what persuade cautious people to cycle. Ultimately, the goal isn't to ban cars, but to give residents a genuine choice.")],
      [("Why are cities building cycle lanes?", ["Evidence shows benefits like less congestion and cleaner air", "To ban cars", "To save money on roads", "Because cyclists asked"], 0),
       ("What do studies say about journey times?", ["They double", "They change very little", "They drop sharply", "They are not measured"], 1),
       ("What persuades cautious people to cycle?", ["Painted lines", "Physical barriers protecting the lanes", "Free bikes", "Lower prices"], 1),
       ("What is the ultimate goal, according to Dr Hale?", ["Ban cars completely", "Give residents a real choice", "Reduce taxes", "Build more roads"], 1)]),
]
