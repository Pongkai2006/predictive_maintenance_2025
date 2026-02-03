import json
import numpy as np
import joblib

WINDOW_SIZE = 50

LABEL = {0: "GOOD", 1: "BAD"}

def load_json(path):
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    batch = raw["sensor"]["batchAcceleration"]
    key = list(batch.keys())[0]
    data = batch[key]

    x = np.array([d["X"] for d in data], dtype=float)
    y = np.array([d["Y"] for d in data], dtype=float)
    z = np.array([d["Z"] for d in data], dtype=float)

    return x, y, z


def extract_features(x, y, z):
    mag = np.sqrt(x**2 + y**2 + z**2)
    return [
        x.mean(), y.mean(), z.mean(),
        x.std(),  y.std(),  z.std(),
        np.sqrt((x**2).mean()),
        np.sqrt((y**2).mean()),
        np.sqrt((z**2).mean()),
        mag.mean(),
        mag.max(),
        mag.min(),
        np.ptp(mag)
    ]


def predict_file(model, json_path):
    x, y, z = load_json(json_path)

    probs = []

    for i in range(0, len(x) - WINDOW_SIZE + 1, WINDOW_SIZE):
        feat = extract_features(
            x[i:i+WINDOW_SIZE],
            y[i:i+WINDOW_SIZE],
            z[i:i+WINDOW_SIZE]
        )
        prob = model.predict_proba([feat])[0]
        probs.append(prob)

    probs = np.array(probs)
    mean_prob = probs.mean(axis=0)

    label = int(mean_prob.argmax())
    return LABEL[label], mean_prob


if __name__ == "__main__":
    model = joblib.load("pdm_binary.pkl")

    result, prob = predict_file(model, "input.json")

    print("RESULT :", result)
    print("PROB   :", prob)
