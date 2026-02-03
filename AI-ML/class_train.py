import os
import json
import numpy as np
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# ================= CONFIG =================
WINDOW_SIZE = 50      # จำนวนจุดต่อ 1 window
STEP = 10             # ระยะเลื่อน window (ซ้อนกัน)
RANDOM_STATE = 42
# =========================================


# ---------- โหลด JSON จาก Firebase format ----------
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


# ---------- แปลง window → feature ----------
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
        np.ptp(mag)          # peak-to-peak
    ]


# ---------- สร้าง dataset จากไฟล์เดียว ----------
def make_dataset(x, y, z, label):
    X, Y = [], []

    if len(x) < WINDOW_SIZE:
        return np.empty((0, 13)), np.empty((0,))

    for i in range(0, len(x) - WINDOW_SIZE + 1, STEP):
        feat = extract_features(
            x[i:i+WINDOW_SIZE],
            y[i:i+WINDOW_SIZE],
            z[i:i+WINDOW_SIZE]
        )
        X.append(feat)
        Y.append(label)

    return np.array(X), np.array(Y)


# ---------- โหลดทุกไฟล์ในโฟลเดอร์ ----------
def load_folder(folder_path, label):
    X_all, Y_all = [], []

    for fname in os.listdir(folder_path):
        if not fname.endswith(".json"):
            continue

        path = os.path.join(folder_path, fname)
        x, y, z = load_json(path)
        X, Y = make_dataset(x, y, z, label)

        if len(X) > 0:
            X_all.append(X)
            Y_all.append(Y)

    if len(X_all) == 0:
        return np.empty((0, 13)), np.empty((0,))

    return np.vstack(X_all), np.hstack(Y_all)


# ================= LOAD DATA =================
Xg, Yg = load_folder("data/good", 0)   # GOOD = 0
Xb, Yb = load_folder("data/bad",  1)   # BAD  = 1

print("GOOD windows:", len(Xg))
print("BAD windows :", len(Xb))

X = np.vstack([Xg, Xb])
Y = np.hstack([Yg, Yb])

# ================= TRAIN ====================
X_train, X_test, y_train, y_test = train_test_split(
    X, Y,
    test_size=0.2,
    shuffle=True,
    random_state=RANDOM_STATE
)

model = RandomForestClassifier(
    n_estimators=400,
    max_depth=10,
    min_samples_leaf=3,
    class_weight="balanced",
    random_state=RANDOM_STATE
)

model.fit(X_train, y_train)

print("\n=== RESULT ===")
print(classification_report(
    y_test,
    model.predict(X_test),
    labels=[0, 1],
    target_names=["GOOD", "BAD"],
    zero_division=0
))

joblib.dump(model, "pdm_binary.pkl")
print("\n✅ Saved model: pdm_binary.pkl")
