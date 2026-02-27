from dotenv import load_dotenv
import os
import tokescope
from openai import OpenAI
import time

load_dotenv()

tokescope.init(api_key="test", endpoint="http://localhost:8000/ingest")

client = OpenAI()
client = tokescope.wrap_client(client)

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Say HIIII"}]
)

print(resp.choices[0].message.content)

time.sleep(2)
