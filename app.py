from flask import Flask, request, jsonify, render_template, send_file
from predict_caption import predict_step, LANGUAGES
from gtts import gTTS
from PIL import Image
import os
import io
import base64
import re

app = Flask(__name__)
UPLOAD_FOLDER = "uploads"
AUDIO_FOLDER = "audio"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(AUDIO_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')  # Ensure index.html is in the templates folder

@app.route('/languages', methods=['GET'])
def get_languages():
    """Return all supported languages"""
    return jsonify({"languages": LANGUAGES})

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    image_file = request.files['image']
    
    # Save the image temporarily
    image_path = os.path.join(UPLOAD_FOLDER, f"temp_{image_file.filename}")
    image_file.save(image_path)
    
    try:
        # Open the image with PIL
        image = Image.open(image_path)
        
        # Generate caption, translate to different languages
        result = predict_step(image)
        
        # Check for errors in caption generation
        if "error" in result:
            return jsonify({"error": result["error"]}), 500
        
        return jsonify({
            "captions": result["translations"],
            "languages": list(result["translations"].keys())
        })
    except Exception as e:
        return jsonify({"error": f"Error processing image: {str(e)}"}), 500
    finally:
        # Clean up the temporary file
        if os.path.exists(image_path):
            os.remove(image_path)

@app.route('/speech', methods=['POST'])
def generate_speech():
    data = request.json
    text = data.get("text")
    language = data.get("language")
    
    if not text or not language:
        return jsonify({"error": "Missing text or language"}), 400
    
    lang_code = LANGUAGES.get(language)
    if not lang_code:
        return jsonify({"error": f"Invalid language: {language}"}), 400
    
    try:
        # Generate a unique filename using timestamp
        import time
        timestamp = int(time.time())
        speech_file = os.path.join(AUDIO_FOLDER, f"speech_{lang_code}_{timestamp}.mp3")
        
        # Generate speech
        tts = gTTS(text=text, lang=lang_code, slow=False)
        tts.save(speech_file)
        
        return jsonify({"audio_url": f"/audio/speech_{lang_code}_{timestamp}.mp3"})
    except Exception as e:
        return jsonify({"error": f"Error generating speech: {str(e)}"}), 500

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_file(os.path.join(AUDIO_FOLDER, filename))

if __name__ == '__main__':
    app.run(debug=True)