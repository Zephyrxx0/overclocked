#!/usr/bin/env python3
"""
Isometric 2D Pixel Art City Map Generator
Minecraft-style top-down isometric view with 5 districts
1024x1024 PNG output with 32x32 pixel tiles
"""

from PIL import Image, ImageDraw
import math

# 16-bit color palette (5-5-5 + transparency)
PALETTE = {
    # Sky
    'sky': (135, 206, 235),      # Light blue
    'sky_dark': (100, 180, 220),
    
    # CBD Core (Red/Purple)
    'cbd_dark': (80, 10, 20),    # Dark red background
    'cbd_red': (220, 40, 50),    # Bright red
    'cbd_purple': (180, 60, 140), # Purple
    'neon_pink': (255, 100, 180), # Neon pink
    'neon_cyan': (100, 255, 255), # Neon cyan
    'window_yellow': (255, 220, 50), # Neon yellow windows
    
    # Waterfront (Blue/Green)
    'water_deep': (30, 100, 180), # Deep blue
    'water_light': (100, 180, 255), # Light blue
    'lake': (50, 130, 200),       # Lake blue
    'grass_bright': (100, 200, 80), # Bright green
    'grass_dark': (60, 140, 50),  # Dark green
    'foliage': (80, 180, 60),     # Foliage green
    'sand': (220, 200, 100),      # Sand/beach
    
    # Industrial (Yellow/Orange)
    'factory': (150, 120, 80),    # Factory brown
    'factory_dark': (100, 80, 50), # Dark factory
    'smoke': (200, 200, 200),     # Smoke gray
    'smoke_dark': (150, 150, 150), # Dark smoke
    'metal': (180, 180, 200),     # Metal gray
    'rust': (200, 120, 80),       # Rust color
    'warning_yellow': (255, 220, 0), # Warning yellow
    'warning_orange': (255, 160, 50), # Warning orange
    
    # Slums (Dark Red/Brown)
    'slum_dark': (60, 40, 40),    # Dark brown
    'slum_wall': (100, 70, 50),   # Broken wall brown
    'slum_darker': (40, 25, 25),  # Very dark
    'graffiti_red': (200, 50, 50), # Graffiti red
    'graffiti_blue': (50, 100, 200), # Graffiti blue
    'shadow': (30, 30, 40),       # Shadow
    'rubble': (120, 100, 80),     # Rubble gray
    
    # Suburbs (Brown/Green)
    'hill': (140, 180, 100),      # Hill green
    'hill_dark': (100, 140, 70),  # Dark hill
    'grass_suburb': (130, 190, 90), # Suburb grass
    'house_brown': (180, 140, 100), # House brown
    'house_dark': (140, 100, 60),   # House dark brown
    'roof': (200, 80, 80),        # Red roof
    'window': (150, 200, 255),    # Window blue
    
    # Common
    'black': (0, 0, 0),
    'white': (255, 255, 255),
    'gray': (128, 128, 128),
    'dark_gray': (64, 64, 64),
}

class IsometricTile:
    """Represents a single isometric tile"""
    def __init__(self, x, y, size=32):
        self.x = x  # Grid position
        self.y = y
        self.size = size  # Tile size in pixels
        self.width = size * 2   # Isometric width
        self.height = size      # Isometric height
    
    def get_pixel_pos(self, origin_x, origin_y):
        """Convert grid position to isometric pixel position"""
        # Isometric projection: 30-degree angle
        px = (self.x - self.y) * self.size + origin_x
        py = (self.x + self.y) * (self.size // 2) + origin_y
        return (px, py)

def draw_isometric_rect(draw, x, y, width, height, color, origin_x, origin_y, tile_size=32):
    """Draw an isometric rectangle (diamond shape)"""
    tile = IsometricTile(x, y, tile_size)
    px, py = tile.get_pixel_pos(origin_x, origin_y)
    
    # Diamond shape for isometric tile
    points = [
        (px + tile_size, py),                    # Top
        (px + tile_size * 2, py + tile_size // 2),  # Right
        (px + tile_size, py + tile_size),       # Bottom
        (px, py + tile_size // 2),              # Left
    ]
    draw.polygon(points, fill=color)
    return points

def draw_skyscraper(draw, x, y, origin_x, origin_y, tile_size=32):
    """Draw neon skyscraper with lit windows"""
    points = draw_isometric_rect(draw, x, y, tile_size * 2, tile_size, PALETTE['cbd_red'], origin_x, origin_y, tile_size)
    
    # Add dark edges for 3D effect
    draw.polygon(
        [points[1], points[2], 
         (points[2][0], points[2][1] + tile_size // 3),
         (points[1][0], points[1][1] + tile_size // 3)],
        fill=PALETTE['cbd_dark']
    )
    
    # Neon windows
    if x % 2 == 0:
        # Lit windows
        for wy in range(3):
            for wx in range(4):
                wx_pos = points[0][0] + tile_size // 4 + wx * (tile_size // 2)
                wy_pos = points[0][1] + tile_size // 8 + wy * (tile_size // 4)
                if 0 <= wx_pos < 1024 and 0 <= wy_pos < 1024:
                    draw.rectangle(
                        [(wx_pos, wy_pos), (wx_pos + 4, wy_pos + 4)],
                        fill=PALETTE['window_yellow']
                    )

def draw_factory(draw, x, y, origin_x, origin_y, tile_size=32):
    """Draw factory with smokestacks"""
    # Factory building
    points = draw_isometric_rect(draw, x, y, tile_size * 2, tile_size, PALETTE['factory'], origin_x, origin_y, tile_size)
    
    # Dark shadow side
    draw.polygon(
        [points[1], points[2], 
         (points[2][0], points[2][1] + tile_size // 4),
         (points[1][0], points[1][1] + tile_size // 4)],
        fill=PALETTE['factory_dark']
    )
    
    # Smokestacks
    for sx in range(3):
        stack_x = points[0][0] + tile_size // 3 + sx * (tile_size // 2)
        stack_y = points[0][1] - tile_size // 3
        if 0 <= stack_x < 1024 and 0 <= stack_y < 1024:
            draw.rectangle(
                [(stack_x, stack_y), (stack_x + 3, stack_y + tile_size // 2)],
                fill=PALETTE['metal']
            )
            # Smoke
            for sm in range(3):
                draw.rectangle(
                    [(stack_x - 2, stack_y - tile_size // 4 - sm * 3),
                     (stack_x + 5, stack_y - tile_size // 4 - sm * 3 + 2)],
                    fill=PALETTE['smoke']
                )

def draw_house(draw, x, y, origin_x, origin_y, tile_size=32):
    """Draw suburban house"""
    points = draw_isometric_rect(draw, x, y, tile_size * 2, tile_size, PALETTE['house_brown'], origin_x, origin_y, tile_size)
    
    # Roof
    roof_top = (points[0][0], points[0][1] - tile_size // 4)
    draw.polygon(
        [roof_top, 
         (points[1][0] - tile_size // 4, points[1][1]),
         (points[3][0] + tile_size // 4, points[3][1])],
        fill=PALETTE['roof']
    )
    
    # Windows
    draw.rectangle(
        [(points[3][0] + 3, points[0][1] + 2), (points[3][0] + 8, points[0][1] + 7)],
        fill=PALETTE['window']
    )
    draw.rectangle(
        [(points[1][0] - 8, points[0][1] + 2), (points[1][0] - 3, points[0][1] + 7)],
        fill=PALETTE['window']
    )
    
    # Door
    draw.rectangle(
        [(points[0][0] - 2, points[2][1] - 4), (points[0][0] + 2, points[2][1])],
        fill=PALETTE['house_dark']
    )

def draw_tree(draw, x, y, origin_x, origin_y, tile_size=32):
    """Draw tree (for waterfront)"""
    tile = IsometricTile(x, y, tile_size)
    px, py = tile.get_pixel_pos(origin_x, origin_y)
    
    # Trunk
    trunk_x = px + tile_size
    trunk_y = py + tile_size // 2
    draw.rectangle(
        [(trunk_x - 2, trunk_y), (trunk_x + 2, trunk_y + tile_size // 2)],
        fill=(100, 60, 30)
    )
    
    # Foliage (circles)
    for fx in range(-tile_size // 2, tile_size // 2, 6):
        for fy in range(-tile_size // 2, 0, 6):
            draw.ellipse(
                [(trunk_x + fx - 3, trunk_y + fy - 3),
                 (trunk_x + fx + 3, trunk_y + fy + 3)],
                fill=PALETTE['foliage']
            )

def draw_water(draw, x, y, origin_x, origin_y, tile_size=32):
    """Draw water tile"""
    points = draw_isometric_rect(draw, x, y, tile_size * 2, tile_size, PALETTE['water_light'], origin_x, origin_y, tile_size)
    
    # Wave pattern
    for wy in range(0, tile_size, 4):
        draw.line(
            [(points[3][0] + 2 + wy, points[3][1] + 1),
             (points[3][0] + 2 + wy + 2, points[3][1] + 1)],
            fill=PALETTE['water_deep'], width=1
        )

def draw_slum_building(draw, x, y, origin_x, origin_y, tile_size=32):
    """Draw dilapidated slum building"""
    points = draw_isometric_rect(draw, x, y, tile_size * 2, tile_size, PALETTE['slum_wall'], origin_x, origin_y, tile_size)
    
    # Crumbling effect
    draw.polygon(
        [points[1], points[2], 
         (points[2][0] - 2, points[2][1] + tile_size // 4),
         (points[1][0] - 2, points[1][1] + tile_size // 4)],
        fill=PALETTE['slum_darker']
    )
    
    # Broken windows
    for bw in range(2):
        for bh in range(2):
            wx = points[0][0] + tile_size // 3 + bw * (tile_size // 2)
            wy = points[0][1] + tile_size // 8 + bh * (tile_size // 4)
            draw.rectangle(
                [(wx, wy), (wx + 3, wy + 3)],
                fill=PALETTE['graffiti_red']
            )
    
    # Graffiti
    draw.line(
        [(points[3][0] + 5, points[0][1] + tile_size // 4),
         (points[1][0] - 5, points[0][1] + tile_size // 4)],
        fill=PALETTE['graffiti_blue'], width=1
    )

def draw_grass(draw, x, y, origin_x, origin_y, color, tile_size=32):
    """Draw grass tile"""
    draw_isometric_rect(draw, x, y, tile_size * 2, tile_size, color, origin_x, origin_y, tile_size)

def draw_hill(draw, x, y, origin_x, origin_y, tile_size=32):
    """Draw hill tile"""
    points = draw_isometric_rect(draw, x, y, tile_size * 2, tile_size, PALETTE['hill'], origin_x, origin_y, tile_size)
    
    # Hill shadow
    draw.polygon(
        [points[1], points[2], 
         (points[2][0], points[2][1] + tile_size // 4),
         (points[1][0], points[1][1] + tile_size // 4)],
        fill=PALETTE['hill_dark']
    )

def generate_city_map():
    """Generate the complete isometric city map"""
    img = Image.new('RGB', (1024, 1024), PALETTE['sky'])
    draw = ImageDraw.Draw(img)
    
    # Draw sky gradient
    for y in range(1024):
        shade = int(PALETTE['sky'][0] - (y / 1024) * 20)
        draw.line([(0, y), (1024, y)], fill=(shade, shade + 30, shade + 60))
    
    # Map origin (center-ish)
    origin_x = 512
    origin_y = 300
    tile_size = 32
    
    # Pentagon formation - 5 districts
    # Center: CBD Core
    # NW: Waterfront
    # NE: Industrial  
    # SW: Slums
    # SE: Suburbs
    
    # Draw terrain base
    
    # CBD Core (center) - red/purple neon city
    for gx in range(-2, 3):
        for gy in range(-2, 3):
            if abs(gx) + abs(gy) <= 2:
                draw_grass(draw, gx, gy, origin_x, origin_y, PALETTE['cbd_dark'], tile_size)
    
    # Add skyscrapers in CBD
    for sx in range(-1, 2):
        for sy in range(-1, 2):
            if abs(sx) + abs(sy) <= 2:
                draw_skyscraper(draw, sx, sy, origin_x, origin_y, tile_size)
    
    # Waterfront NW
    wf_ox = origin_x - 300
    wf_oy = origin_y - 200
    for gx in range(-3, 3):
        for gy in range(-3, 3):
            if (gx + 5)**2 + (gy - 3)**2 <= 20:  # Circular region
                if (gx + 4) % 2 == 0:
                    draw_grass(draw, gx, gy, wf_ox, wf_oy, PALETTE['grass_bright'], tile_size)
                else:
                    draw_water(draw, gx, gy, wf_ox, wf_oy, tile_size)
    
    # Add trees in waterfront
    for tx in [-1, 0, 1]:
        for ty in [-1, 0, 1]:
            if (tx + 4)**2 + (ty - 2)**2 <= 12:
                draw_tree(draw, tx, ty, wf_ox, wf_oy, tile_size)
    
    # Industrial NE
    ind_ox = origin_x + 300
    ind_oy = origin_y - 200
    for gx in range(-3, 3):
        for gy in range(-3, 3):
            if (gx - 5)**2 + (gy - 3)**2 <= 20:
                draw_grass(draw, gx, gy, ind_ox, ind_oy, PALETTE['factory'], tile_size)
    
    # Add factories in industrial
    for fx in [-1, 0, 1]:
        for fy in [-1, 0, 1]:
            if (fx - 4)**2 + (fy - 2)**2 <= 12:
                draw_factory(draw, fx, fy, ind_ox, ind_oy, tile_size)
    
    # Slums SW
    slum_ox = origin_x - 300
    slum_oy = origin_y + 200
    for gx in range(-3, 3):
        for gy in range(-3, 3):
            if (gx + 5)**2 + (gy + 3)**2 <= 20:
                draw_grass(draw, gx, gy, slum_ox, slum_oy, PALETTE['slum_dark'], tile_size)
    
    # Add slum buildings
    for slx in [-1, 0, 1]:
        for sly in [-1, 0, 1]:
            if (slx + 4)**2 + (sly + 2)**2 <= 12:
                draw_slum_building(draw, slx, sly, slum_ox, slum_oy, tile_size)
    
    # Suburbs SE
    sub_ox = origin_x + 300
    sub_oy = origin_y + 200
    for gx in range(-3, 3):
        for gy in range(-3, 3):
            if (gx - 5)**2 + (gy + 3)**2 <= 20:
                if (gx - 4) % 2 == 0:
                    draw_hill(draw, gx, gy, sub_ox, sub_oy, tile_size)
                else:
                    draw_grass(draw, gx, gy, sub_ox, sub_oy, PALETTE['grass_suburb'], tile_size)
    
    # Add houses in suburbs
    for hx in [-1, 0, 1]:
        for hy in [-1, 0, 1]:
            if (hx - 4)**2 + (hy + 2)**2 <= 12:
                draw_house(draw, hx, hy, sub_ox, sub_oy, tile_size)
    
    # Draw connecting roads (simple paths between districts)
    # CBD to Waterfront
    draw.line(
        [(origin_x - 100, origin_y - 50), (wf_ox + 100, wf_oy + 50)],
        fill=PALETTE['gray'], width=2
    )
    # CBD to Industrial
    draw.line(
        [(origin_x + 100, origin_y - 50), (ind_ox - 100, ind_oy + 50)],
        fill=PALETTE['gray'], width=2
    )
    # CBD to Slums
    draw.line(
        [(origin_x - 100, origin_y + 50), (slum_ox + 100, slum_oy - 50)],
        fill=PALETTE['gray'], width=2
    )
    # CBD to Suburbs
    draw.line(
        [(origin_x + 100, origin_y + 50), (sub_ox - 100, sub_oy - 50)],
        fill=PALETTE['gray'], width=2
    )
    
    # Add atmospheric effects
    # Neon glow around CBD
    for glow in range(5, 0, -1):
        alpha = int(255 * (1 - glow / 5) * 0.2)
        draw.ellipse(
            [(origin_x - 150 - glow * 10, origin_y - 100 - glow * 5),
             (origin_x + 150 + glow * 10, origin_y + 100 + glow * 5)],
            outline=(255, 100, 150, alpha), width=1
        )
    
    # Industrial smoke haze
    for smoke in range(10):
        opacity = int(255 * (1 - smoke / 10) * 0.15)
        draw.ellipse(
            [(ind_ox - 100 + smoke * 5, ind_oy - 50 + smoke * 3),
             (ind_ox + 100 - smoke * 5, ind_oy + 50 - smoke * 3)],
            fill=(200, 200, 200, opacity), width=1
        )
    
    # Save the map
    output_path = r'c:\Users\Dell\Desktop\overclocked\worldsim-frontend\public\isometric_city_map.png'
    img.save(output_path, 'PNG')
    print(f"✓ Isometric city map generated: {output_path}")
    print(f"  Size: 1024x1024 pixels")
    print(f"  Districts: CBD Core, Waterfront, Industrial, Slums, Suburbs")
    print(f"  Ready for Phaser/PixiJS integration")

if __name__ == '__main__':
    generate_city_map()
