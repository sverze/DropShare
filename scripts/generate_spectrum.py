#!/usr/bin/env python3
"""
Spectrum analyzer that replicates Spek's appearance
Uses scipy instead of librosa for lighter dependencies
"""

import sys
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Headless backend
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
from matplotlib.colors import LinearSegmentedColormap
from scipy import signal
from scipy.io import wavfile
import subprocess
import tempfile
import os

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

def load_audio(input_file):
    """Load audio file using ffmpeg to convert to WAV first"""
    # Create temp WAV file
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        tmp_path = tmp.name
    
    try:
        # Convert to WAV using ffmpeg
        subprocess.run([
            'ffmpeg', '-y', '-i', input_file,
            '-ac', '1',  # Mono
            '-ar', '44100',  # 44.1kHz
            '-f', 'wav',
            tmp_path
        ], capture_output=True, check=True)
        
        # Read WAV file
        sr, audio = wavfile.read(tmp_path)
        
        # Normalize to float
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0
        elif audio.dtype == np.int32:
            audio = audio.astype(np.float32) / 2147483648.0
        elif audio.dtype == np.uint8:
            audio = (audio.astype(np.float32) - 128) / 128.0
            
        return audio, sr
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

def generate_spectrum(input_file, output_file, width=1600, height=800):
    """Generate a Spek-like spectrogram"""
    
    # Load audio file
    print(f"Loading {input_file}...", file=sys.stderr)
    audio, sr = load_audio(input_file)
    duration = len(audio) / sr
    
    print(f"Duration: {duration:.1f}s, Sample rate: {sr}Hz", file=sys.stderr)
    
    # Calculate spectrogram using scipy
    nperseg = 4096
    noverlap = nperseg - int(len(audio) / (width * 0.8))
    noverlap = max(noverlap, nperseg // 2)
    
    frequencies, times, Sxx = signal.spectrogram(
        audio, sr,
        nperseg=nperseg,
        noverlap=noverlap,
        scaling='spectrum'
    )
    
    # Convert to dB
    Sxx_db = 10 * np.log10(Sxx + 1e-10)
    
    # Normalize to 0-1 range for colormap
    vmin, vmax = -120, 0
    Sxx_norm = np.clip((Sxx_db - vmin) / (vmax - vmin), 0, 1)
    
    # Create figure
    dpi = 100
    fig_width = width / dpi
    fig_height = height / dpi
    
    fig, ax = plt.subplots(figsize=(fig_width, fig_height), dpi=dpi)
    
    # Use Spek-like colormap
    cmap = create_spek_colormap()
    
    # Plot spectrogram
    img = ax.pcolormesh(times, frequencies, Sxx_norm, cmap=cmap, shading='auto')
    
    # Limit frequency range to 22kHz
    ax.set_ylim(0, min(22050, sr // 2))
    
    # Style the plot
    ax.set_facecolor('#000000')
    fig.patch.set_facecolor('#1a1a2e')
    
    # Format Y-axis (frequency) as kHz
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(format_freq))
    ax.yaxis.set_major_locator(ticker.MultipleLocator(2000))
    ax.set_ylabel('', fontsize=10, color='#cccccc')
    
    # Format X-axis (time) as M:SS
    ax.xaxis.set_major_formatter(ticker.FuncFormatter(format_time))
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
    cbar = fig.colorbar(img, ax=ax, pad=0.02)
    cbar.ax.set_ylabel('dB', color='#cccccc', fontsize=9)
    # Set colorbar ticks to show dB values
    cbar.set_ticks([0, 0.25, 0.5, 0.75, 1.0])
    cbar.set_ticklabels(['-120', '-90', '-60', '-30', '0'])
    cbar.ax.tick_params(colors='#cccccc', labelsize=9)
    cbar.outline.set_edgecolor('#444444')
    
    # Style spines
    for spine in ax.spines.values():
        spine.set_color('#444444')
    
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
