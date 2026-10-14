"""Temporary guide voice-over for the v3 script (Kokoro, open model, runs locally).
Replace with the final ElevenLabs Ruhaan read when it arrives.
Usage: python3 -I tools/guide_vo.py <kokoro-model-dir>"""
import os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

LINES = [
    ("own", "How many do you own?"),
    ("can", "Now you can."),
    ("us", "US stocks, on M-Stock."),
    ("slice", "Own a slice."),
    ("dollar", "From one dollar."),
    ("count", "Five thousand plus US stocks and E.T.F.s."),
    ("digital", "One hundred percent digital account opening."),
    ("rupees", "Add funds in rupees."),
    ("app", "One app for Indian and US investing."),
    ("habit", "Customer by habit."),
    ("choice", "Shareholder by choice."),
]
d = sys.argv[1]
k = Kokoro(os.path.join(d, "kokoro-v1.0.onnx"), os.path.join(d, "voices-v1.0.bin"))
voice = 0.55 * k.get_voice_style("hm_omega") + 0.45 * k.get_voice_style("bm_george")
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets/vo/guide")
for key, text in LINES:
    y, sr = k.create(text, voice=voice, speed=0.9, lang="en-us")
    sf.write(f"{out}/{key}.wav", y, sr)
    print(key, round(len(y) / sr, 2), "s")
