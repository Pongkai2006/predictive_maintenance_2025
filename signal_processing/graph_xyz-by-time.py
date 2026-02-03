import json
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider

with open(r"YOUR PATH", "r") as f:
    data = json.load(f)

batch_data = data["sensor"]["batchAcceleration"]
merged_data = []
for key, entries in batch_data.items():
    merged_data.extend(entries)

# เรียงตามเวลา
merged_data.sort(key=lambda x: x["timestamp"])

timestamps = [entry["timestamp"] for entry in merged_data]
x_values = [entry["X"] for entry in merged_data]
y_values = [entry["Y"] for entry in merged_data]
z_values = [entry["Z"] for entry in merged_data]

# สร้าง figure
fig, ax = plt.subplots(figsize=(14, 6))
plt.subplots_adjust(bottom=0.35)

line_x, = ax.plot([], [], label='X', color='r')
line_y, = ax.plot([], [], label='Y', color='g')
line_z, = ax.plot([], [], label='Z', color='b')

ax.set_xlabel("Timestamp")
ax.set_ylabel("Acceleration")
ax.set_title("Acceleration vs Time")
ax.grid(True)
ax.legend()

# สร้าง sliders
min_t = timestamps[0]
max_t = timestamps[-1]

ax_slider_min = plt.axes([0.2, 0.2, 0.65, 0.03])
slider_min = Slider(ax_slider_min, 'Start', min_t, max_t, valinit=min_t, valstep=1)

ax_slider_max = plt.axes([0.2, 0.1, 0.65, 0.03])
slider_max = Slider(ax_slider_max, 'End', min_t, max_t, valinit=max_t, valstep=1)

# ฟังก์ชันอัปเดตกราฟ
def update(val):
    min_time = slider_min.val
    max_time = slider_max.val

    if min_time >= max_time:
        return  # ข้ามถ้าช่วงผิด

    indices = [i for i, t in enumerate(timestamps) if min_time <= t <= max_time]
    if indices:
        i_start, i_end = indices[0], indices[-1]
        time_slice = timestamps[i_start:i_end+1]
        x_slice = x_values[i_start:i_end+1]
        y_slice = y_values[i_start:i_end+1]
        z_slice = z_values[i_start:i_end+1]

        line_x.set_data(time_slice, x_slice)
        line_y.set_data(time_slice, y_slice)
        line_z.set_data(time_slice, z_slice)

        ax.set_xlim([min_time, max_time])
        all_vals = x_slice + y_slice + z_slice
        ax.set_ylim([min(all_vals), max(all_vals)])
        fig.canvas.draw_idle()

slider_min.on_changed(update)
slider_max.on_changed(update)

update(None)
plt.show()
