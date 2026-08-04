#!/usr/bin/env python3
"""
Spectrum analyzer that replicates Spek's appearance
Generates spectrogram with kHz labels, M:SS time format, and dB scale
"""

import sys
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Headless backend
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
from matplotlib.colors import LinearSegmentedColormap
import librosa
import librosa.display

def format_time(seconds, pos=None):
    """Format time as M:SS"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"

def format_freq(freq, pos=None):
    """Format frequency as kHz"""
    if freq >= 1000:
        return f"{freq/1000:.0f} kHz"
    else:
        return f"{freq:.0f} Hz"

def create_spek_colormap():
    """Create a colormap similar to Spek's"""
    colors = [
        (0.0, '#000000'),   # Black (silence)
        (0.1, '#1a0533'),   # Dark purple
        (0.25, '#4b0082'),  # Indigo
        (0.4, '#8b008b'),   # Dark magenta
        (0.55, '#ff0080'),  # Pink
        (0.7, '#ff4500'),   # Orange red
        (0.85, '#ffa500'),  # Orange
        (0.95, '#ffff00'),  # Yellow
        (1.0, '#ffffff'),   # White (loudest)
    ]
    
    positions = [c[0] for c in colors]
    hex_colors = [c[1] for c in colors]
    
    # Convert hex to RGB
    rgb_colors = []
    for h in hex_colors:
        h = h.lstrip('#')
        rgb_colors.append(tuple(int(h[i:i+2], 16)/255 for i in (0, 2, 4)))
    
    return LinearSegmentedColormap.from_list('spek', list(zip(positions, rgb_colors)))

def generate_spectrum(input_file, output_file, width=1600, height=800):
    """Generate a Spek-like spectrogram"""
    
    # Load audio file
    print(f"Loading {input_file}...", file=sys.stderr)
    y, sr = librosa.load(input_file, sr=None, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    
    print(f"Duration: {duration:.1f}s, Sample rate: {sr}Hz", file=sys.stderr)
    
    # Calculate STFT
    # Use more FFT bins for better frequency resolution
    n_fft = 4096
    hop_length = int(len(y) / (width * 0.8))  # Adjust for image width
    hop_length = max(hop_length, 512)
    
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    S_db = librosa.amplitude_to_db(np.abs(D), ref=np.max)
    
    # Create figure with specific size
    dpi = 100
    fig_width = width / dpi
    fig_height = height / dpi
    
    fig, ax = plt.subplots(figsize=(fig_width, fig_height), dpi=dpi)
    
    # Use Spek-like colormap
    cmap = create_spek_colormap()
    
    # Plot spectrogram
    img = librosa.display.specshow(
        S_db,
        sr=sr,
        hop_length=hop_length,
        x_axis='time',
        y_axis='linear',  # Linear scale like Spek
        ax=ax,
        cmap=cmap,
        vmin=-120,
        vmax=0
    )
    
    # Style the plot to match Spek
    ax.set_facecolor('#000000')
    fig.patch.set_facecolor('#1a1a2e')
    
    # Format Y-axis (frequency) as kHz
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(format_freq))
    ax.yaxis.set_major_locator(ticker.MultipleLocator(2000))  # Every 2 kHz
    ax.set_ylabel('', fontsize=10, color='#cccccc')
    
    # Format X-axis (time) as M:SS
    ax.xaxis.set_major_formatter(ticker.FuncFormatter(format_time))
    # Set sensible tick intervals based on duration
    if duration <= 60:
        ax.xaxis.set_major_locator(ticker.MultipleLocator(10))
    elif duration <= 300:
        ax.xaxis.set_major_locator(ticker.MultipleLocator(30))
    else:
        ax.xaxis.set_major_locator(ticker.MultipleLocator(60))
    ax.set_xlabel('', fontsize=10, color='#cccccc')
    
    # Style tick labels
    ax.tick_params(axis='both', colors='#cccccc', labelsize=9)
    
    # Add colorbar (dB scale)
    cbar = fig.colorbar(img, ax=ax, format='%+.0f dB', pad=0.02)
    cbar.ax.tick_params(colors='#cccccc', labelsize=9)
    cbar.ax.yaxis.set_tick_params(color='#cccccc')
    cbar.outline.set_edgecolor('#444444')
    
    # Remove spines for cleaner look
    for spine in ax.spines.values():
        spine.set_color('#444444')
    
    # Tight layout
    plt.tight_layout()
    
    # Save
    print(f"Saving to {output_file}...", file=sys.stderr)
    plt.savefig(output_file, facecolor=fig.get_facecolor(), edgecolor='none', dpi=dpi)
    plt.close()
    
    print("Done!", file=sys.stderr)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input_audio> <output_image> [width] [height]", file=sys.stderr)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
    height = int(sys.argv[4]) if len(sys.argv) > 4 else 800
    
    generate_spectrum(input_file, output_file, width, height)
