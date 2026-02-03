import json

with open(r"10minutes_fan_raw_data.json", "r") as f:
    data = json.load(f)

batch_data = data["sensor"]["batchAcceleration"]

merged_data = []
for key, entries in batch_data.items():
    merged_data.extend(entries)

merged_data.sort(key=lambda x: x["timestamp"])

for item in merged_data:
    print(item)

with open(r"merged_acceleration_data.json", "w") as out_file:
    json.dump(merged_data, out_file, indent=2)
