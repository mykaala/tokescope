from openai import OpenAI
import tokescope
import time

tokescope.init(
    api_key="test",
    endpoint="http://localhost:8000/ingest",
    capture_content=False,
    providers=["openai"]
)


client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Say hello briefly."}]
)

print(resp.choices[0].message.content)
time.sleep(2)
