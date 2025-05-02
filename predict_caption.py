from transformers import VisionEncoderDecoderModel, ViTImageProcessor, AutoTokenizer
import torch
from PIL import Image
from deep_translator import GoogleTranslator
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supported languages
LANGUAGES = {
    'English': 'en',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de',
    'Italian': 'it',
    'Hindi': 'hi',
    'Chinese': 'zh',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Arabic': 'ar',
    'Russian': 'ru',
    'Portuguese': 'pt',
    # Added South Indian languages and Bengali
    'Telugu': 'te',
    'Tamil': 'ta',
    'Kannada': 'kn',
    'Malayalam': 'ml',
    'Bengali': 'bn'
}

# Model loading function with error handling
def load_model():
    try:
        model_name = 'nlpconnect/vit-gpt2-image-captioning'
        model = VisionEncoderDecoderModel.from_pretrained(model_name)
        feature_extractor = ViTImageProcessor.from_pretrained(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Ensure pad token ID is set
        tokenizer.pad_token = tokenizer.eos_token
        model.config.pad_token_id = model.config.eos_token_id
        
        # Set device (GPU if available, else CPU)
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model.to(device)
        
        logger.info(f"Model loaded successfully. Using device: {device}")
        
        return {
            'model': model,
            'feature_extractor': feature_extractor,
            'tokenizer': tokenizer,
            'device': device
        }
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        return None

# Load model components
model_components = load_model()

# Define generation parameters
gen_kwargs = {
    'max_length': 32,  # Increased for more detailed captions
    'num_beams': 4,
    'early_stopping': True
}

def translate_caption(caption, lang_code):
    """Translate caption into the selected language."""
    if not caption.strip():
        return "Error: Empty text for translation."

    try:
        # For English, just return the original caption
        if lang_code == 'en':
            return caption
            
        translated_text = GoogleTranslator(source='en', target=lang_code).translate(caption)
        return translated_text
    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        return f"Translation error: {str(e)}"

def predict_step(image):
    """Generate caption, translate, and provide output."""
    if model_components is None:
        return {"error": "Model not loaded correctly. Please check server logs."}
    
    try:
        model = model_components['model']
        feature_extractor = model_components['feature_extractor']
        tokenizer = model_components['tokenizer']
        device = model_components['device']
        
        # Ensure image is in RGB mode (required by the model)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Extract features from the image
        pixel_values = feature_extractor(images=[image], return_tensors='pt').pixel_values.to(device)
        
        # Generate caption
        output_ids = model.generate(pixel_values, **gen_kwargs)
        
        # Decode caption
        caption = tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()
        
        if not caption:
            return {"error": "Caption generation failed."}
        
        logger.info(f"Generated caption: {caption}")
        
        # Generate translations
        translations = {}
        for lang, lang_code in LANGUAGES.items():
            translations[lang] = translate_caption(caption, lang_code)
        
        return {
            'caption': caption,
            'translations': translations
        }
    except RuntimeError as e:
        if "CUDA out of memory" in str(e):
            return {"error": "GPU memory exceeded. Try with a smaller image."}
        return {"error": f"Runtime error: {str(e)}"}
    except Exception as e:
        logger.error(f"Error generating caption: {str(e)}")
        return {"error": f"Error generating caption: {str(e)}"}