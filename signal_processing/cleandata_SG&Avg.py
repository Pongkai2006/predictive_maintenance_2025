import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider, RadioButtons
from scipy.signal import savgol_filter

# === Load JSON ===
with open(r"10minutes_fan_raw.json", "r") as f:
    data = json.load(f)

batch_data = data["sensor"]["batchAcceleration"]
merged_data = []
for key, entries in batch_data.items():
    merged_data.extend(entries)

merged_data.sort(key=lambda x: x["timestamp"])

timestamps = np.array([entry["timestamp"] for entry in merged_data])
x_values = np.array([entry["X"] for entry in merged_data])
y_values = np.array([entry["Y"] for entry in merged_data])
z_values = np.array([entry["Z"] for entry in merged_data])

# === FIGURE 1: RAW ===
fig_raw, axes_raw = plt.subplots(3, 1, figsize=(14, 10), sharex=True)
plt.subplots_adjust(bottom=0.3)

line_x_raw, = axes_raw[0].plot([], [], label='X Raw', color='r')
line_y_raw, = axes_raw[1].plot([], [], label='Y Raw', color='g')
line_z_raw, = axes_raw[2].plot([], [], label='Z Raw', color='b')

for ax, label in zip(axes_raw, ['X', 'Y', 'Z']):
    ax.set_ylabel(f"{label} Acceleration")
    ax.grid(True)
    ax.legend()

axes_raw[2].set_xlabel("Timestamp")
fig_raw.suptitle("Raw Acceleration Data")

# === FIGURE 2: Adjacent-Averaging & Savitzky-Golay ===
fig_smooth, axes_smooth = plt.subplots(3, 1, figsize=(14, 10), sharex=True)
plt.subplots_adjust(bottom=0.3, left=0.25)

line_x_raw_smooth, = axes_smooth[0].plot([], [], label='X Raw', color='lightgray')
line_y_raw_smooth, = axes_smooth[1].plot([], [], label='Y Raw', color='lightgray')
line_z_raw_smooth, = axes_smooth[2].plot([], [], label='Z Raw', color='lightgray')

# Adjacent-Averaging
line_x_avg, = axes_smooth[0].plot([], [], label='X Avg', color='r', linestyle='--')
line_y_avg, = axes_smooth[1].plot([], [], label='Y Avg', color='g', linestyle='--')
line_z_avg, = axes_smooth[2].plot([], [], label='Z Avg', color='b', linestyle='--')

# Savitzky-Golay
line_x_sg, = axes_smooth[0].plot([], [], label='X SG', color='m', linestyle=':')
line_y_sg, = axes_smooth[1].plot([], [], label='Y SG', color='c', linestyle=':')
line_z_sg, = axes_smooth[2].plot([], [], label='Z SG', color='y', linestyle=':')

for ax, label in zip(axes_smooth, ['X', 'Y', 'Z']):
    ax.set_ylabel(f"{label} Acceleration")
    ax.grid(True)
    ax.legend()

axes_smooth[2].set_xlabel("Timestamp")
fig_smooth.suptitle("Adjacent-Averaging & Savitzky-Golay Smoothing")

# === SLIDERS ===
ax_slider_start = plt.axes([0.2, 0.1, 0.65, 0.03])
ax_slider_end = plt.axes([0.2, 0.05, 0.65, 0.03])

min_timestamp = min(timestamps)
max_timestamp = max(timestamps)

slider_start = Slider(ax_slider_start, 'Start Timestamp', min_timestamp, max_timestamp, valinit=min_timestamp, valstep=1)
slider_end = Slider(ax_slider_end, 'End Timestamp', min_timestamp, max_timestamp, valinit=max_timestamp, valstep=1)

# === Radio buttons for window size ===
ax_radio = plt.axes([0.05, 0.4, 0.15, 0.2])
radio = RadioButtons(ax_radio, ('3', '5', '11', '21', '51'))  # Must be odd integers
current_window_size = [5]  # default window length

# === Adjacent-Averaging ===
def moving_average(signal, window_size):
    window = np.ones(int(window_size)) / float(window_size)
    return np.convolve(signal, window, 'same')

# === Update function ===
def update(val):
    start_time = slider_start.val
    end_time = slider_end.val

    if start_time >= end_time:
        return

    indices = np.where((timestamps >= start_time) & (timestamps <= end_time))[0]

    if len(indices) < int(current_window_size[0]):
        return

    first_index = indices[0]
    last_index = indices[-1]

    ts = timestamps[first_index:last_index+1]
    window_len = int(current_window_size[0])
    polyorder = 2  # Fixed for Savitzky-Golay, must be < window_len

    for raw_line, vals in zip(
        [line_x_raw, line_y_raw, line_z_raw],
        [x_values, y_values, z_values]
    ):
        raw_line.set_data(ts, vals[first_index:last_index+1])

    for ax, vals in zip(axes_raw, [x_values, y_values, z_values]):
        ax.set_xlim([start_time, end_time])
        ax.set_ylim([
            np.min(vals[first_index:last_index+1]),
            np.max(vals[first_index:last_index+1])
        ])
    fig_raw.canvas.draw_idle()

    # === For smoothing figure ===
    for raw_smooth_line, avg_line, sg_line, vals in zip(
        [line_x_raw_smooth, line_y_raw_smooth, line_z_raw_smooth],
        [line_x_avg, line_y_avg, line_z_avg],
        [line_x_sg, line_y_sg, line_z_sg],
        [x_values, y_values, z_values]
    ):
        slice_signal = vals[first_index:last_index+1]

        # Raw copy
        raw_smooth_line.set_data(ts, slice_signal)

        # Adjacent-Averaging
        avg_smoothed = moving_average(slice_signal, window_len)
        avg_line.set_data(ts, avg_smoothed)

        # Savitzky-Golay
        if len(slice_signal) >= window_len:
            sg_smoothed = savgol_filter(slice_signal, window_len, polyorder)
            sg_line.set_data(ts, sg_smoothed)
        else:
            sg_line.set_data([], [])

    for ax, vals in zip(axes_smooth, [x_values, y_values, z_values]):
        ax.set_xlim([start_time, end_time])
        ax.set_ylim([
            np.min(vals[first_index:last_index+1]),
            np.max(vals[first_index:last_index+1])
        ])
    fig_smooth.canvas.draw_idle()

# === Radio button callback ===
def change_window(label):
    current_window_size[0] = int(label)
    update(None)

radio.on_clicked(change_window)

slider_start.on_changed(update)
slider_end.on_changed(update)

update(None)

plt.show()
