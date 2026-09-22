import os
import glob
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

# Configuration
INPUT_DIR = "input"
OUTPUT_BASE_DIR = os.path.join(INPUT_DIR, "extracted_images")
LOGO_Y_THRESHOLD = 0.15  # Upper 15% of the slide to filter out header logos

def extract_pptx_data():
    """
    Parses PowerPoint files to extract text and physical images, 
    mapping their relative X/Y spatial coordinates for LLM processing.
    """
    # Find all .pptx files, ignoring Microsoft Office temporary lock files (~$)
    pptx_files = [
        f for f in glob.glob(os.path.join(INPUT_DIR, "*.pptx")) 
        if not os.path.basename(f).startswith("~$")
    ]

    if not pptx_files:
        print(f"⚠️ No valid .pptx files found in '{INPUT_DIR}'.")
        return

    for pptx_path in pptx_files:
        filename = os.path.basename(pptx_path)
        base_name = os.path.splitext(filename)[0]
        
        print(f"\n{'='*60}")
        print(f"🚀 Processing spatial map and physical images: {filename}")
        print(f"{'='*60}")
        
        # Create a dedicated output directory for the current presentation's images
        output_img_dir = os.path.join(OUTPUT_BASE_DIR, base_name)
        os.makedirs(output_img_dir, exist_ok=True)
        
        try:
            prs = Presentation(pptx_path)
            slide_width = prs.slide_width
            slide_height = prs.slide_height

            for i, slide in enumerate(prs.slides):
                print(f"\n--- SLIDE {i + 1} ---")
                
                elements = []
                
                def process_shape(shape):
                    """
                    Recursively processes shapes, extracting text, native pictures, 
                    and hidden blipFill image blobs.
                    """
                    # Handle grouped shapes by entering them recursively
                    if getattr(shape, 'shape_type', None) == MSO_SHAPE_TYPE.GROUP:
                        for sub_shape in shape.shapes:
                            process_shape(sub_shape)
                        return

                    # Ignore elements without positional data
                    if not hasattr(shape, 'top') or not hasattr(shape, 'left'):
                        return
                        
                    # Calculate relative coordinates (0.0 to 1.0)
                    rel_x = shape.left / slide_width
                    rel_y = shape.top / slide_height
                    shape_type = getattr(shape, 'shape_type', None)
                    
                    # Sanitize shape name for filesystem usage
                    name = getattr(shape, 'name', 'Element').replace(" ", "_")
                    
                    # 1. Attempt to extract text content
                    text_content = ""
                    if getattr(shape, "has_text_frame", False) and shape.has_text_frame:
                        text_content = " \\n ".join([
                            p.text.strip() for p in shape.text_frame.paragraphs if p.text.strip()
                        ])
                    
                    # LOGO FILTER: Ignore visual elements (no text) in the upper threshold
                    if rel_y < LOGO_Y_THRESHOLD and not text_content:
                        return
                        
                    if text_content:
                        elements.append({
                            "type": "Texto", 
                            "content": text_content, 
                            "x": rel_x, 
                            "y": rel_y
                        })
                    else:
                        blob = None
                        ext = "png"
                        
                        # 2A. Standard rasterized image (<p:pic>)
                        if shape_type == MSO_SHAPE_TYPE.PICTURE or hasattr(shape, "image"):
                            blob = shape.image.blob
                            ext = getattr(shape.image, "ext", "png")
                            
                        # 2B. Vector shape with a hidden image fill (Picture Fill)
                        elif shape_type in [MSO_SHAPE_TYPE.FREEFORM, MSO_SHAPE_TYPE.AUTO_SHAPE]:
                            if hasattr(shape, "fill") and getattr(shape.fill, "type", None) == 6:
                                try:
                                    # Navigate XML tree to find the relation ID (rId)
                                    blips = shape._element.xpath('.//a:blip')
                                    if blips:
                                        rId = blips[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                                        if rId:
                                            # Extract raw physical file via SlidePart relationships
                                            rel = shape.part.rels[rId]
                                            image_part = rel.target_part
                                            blob = image_part.blob
                                            
                                            # Attempt to extract actual extension from content type
                                            c_type = getattr(image_part, "content_type", "")
                                            ext = c_type.split('/')[-1] if '/' in c_type else "png"
                                except Exception as e:
                                    print(f"⚠️ Could not extract physical image from {name}: {e}")
                            else:
                                # Pure vector path without image fill
                                elements.append({"type": "Vector", "content": f"[{name}]", "x": rel_x, "y": rel_y})
                        
                        # If a binary image was successfully extracted, save it
                        if blob:
                            image_name = f"slide_{i+1}_{name}.{ext}"
                            image_path = os.path.join(output_img_dir, image_name)
                            
                            with open(image_path, "wb") as f:
                                f.write(blob)
                                
                            # Prepare standard Markdown image syntax for LLM context
                            elements.append({
                                "type": "Imagen", 
                                "content": f"![{image_name}]()", 
                                "x": rel_x, 
                                "y": rel_y
                            })

                # Process all root shapes in the current slide
                for shape in slide.shapes:
                    process_shape(shape)

                # Sort spatially: top-to-bottom (Y), then left-to-right (X)
                elements.sort(key=lambda e: (round(e["y"], 2), e["x"]))

                # Output formatted schema for LLM processing
                for el in elements:
                    print(f"[X:{el['x']:.2f}, Y:{el['y']:.2f}] {el['type']}: {el['content']}")

        except Exception as e:
            print(f"❌ Error processing {filename}: {e}")

if __name__ == "__main__":
    extract_pptx_data()