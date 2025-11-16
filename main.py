#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

def create_gradient(width, height, color1, color2):
    """建立漸層背景"""
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)
    
    # 將 hex 轉 RGB
    r1, g1, b1 = tuple(int(color1[i:i+2], 16) for i in (1, 3, 5))
    r2, g2, b2 = tuple(int(color2[i:i+2], 16) for i in (1, 3, 5))
    
    # 繪製漸層
    for y in range(height):
        ratio = y / height
        r = int(r1 + (r2 - r1) * ratio)
        g = int(g1 + (g2 - g1) * ratio)
        b = int(b1 + (b2 - b1) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    return img

def find_chinese_font():
    """尋找可用的中文字體"""
    font_paths = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansTC-Regular.otf",
        "/usr/share/fonts/truetype/noto/NotoSansTC-Regular.otf",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/truetype/arphic/uming.ttc",
        "/usr/share/fonts/truetype/arphic/ukai.ttc",
    ]
    
    for path in font_paths:
        if os.path.exists(path):
            print(f"✅ 找到中文字體: {path}")
            return path
    
    print("❌ 找不到中文字體！")
    return None

def create_richmenu(scheme='purple'):
    print(f'🎨 生成 {scheme} 配色...')
    
    # 配色方案
    colors = {
        'purple': ('#667eea', '#764ba2'),
        'green': ('#10b981', '#059669'),
        'blue': ('#3b82f6', '#2563eb'),
        'dark': ('#1e293b', '#0f172a')
    }
    
    # 建立漸層背景
    img = create_gradient(2500, 1686, colors[scheme][0], colors[scheme][1])
    draw = ImageDraw.Draw(img)
    
    # 按鈕配置（移除 Emoji）
    buttons = [
        (0, 0, 833, 843, '上班打卡', 'Clock In'),
        (833, 0, 834, 843, '下班打卡', 'Clock Out'),
        (1667, 0, 833, 843, '人臉打卡', 'Face Recognition'),
        (0, 843, 833, 843, '薪資查詢', 'Salary Info'),
        (833, 843, 834, 843, '請假申請', 'Leave Request'),
        (1667, 843, 833, 843, '完整功能', 'Full Features')
    ]
    
    # 載入字體
    chinese_font_path = find_chinese_font()
    
    try:
        if chinese_font_path:
            font_text_cn = ImageFont.truetype(chinese_font_path, 90)      # 中文字體加大
            font_text_en = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 45)  # 英文字體
            print(f"✅ 使用中文字體: 90px, 英文字體: 45px")
        else:
            raise Exception("No Chinese font found")
    except Exception as e:
        print(f"⚠️ 字體載入失敗: {e}")
        return None
    
    # 繪製按鈕
    for x, y, w, h, text_cn, text_en in buttons:
        # 邊框
        draw.rectangle([x, y, x + w, y + h], outline=(255, 255, 255, 80), width=3)
        
        centerX = x + w // 2
        centerY = y + h // 2
        
        # 中文文字（垂直置中，稍微往上）
        bbox_cn = draw.textbbox((0, 0), text_cn, font=font_text_cn)
        text_cn_w = bbox_cn[2] - bbox_cn[0]
        text_cn_h = bbox_cn[3] - bbox_cn[1]
        text_cn_y = centerY - 40  # 往上移一點
        
        draw.text(
            (centerX - text_cn_w // 2, text_cn_y - text_cn_h // 2), 
            text_cn, 
            fill='white', 
            font=font_text_cn
        )
        
        # 英文文字（在中文下方，保持間距）
        bbox_en = draw.textbbox((0, 0), text_en, font=font_text_en)
        text_en_w = bbox_en[2] - bbox_en[0]
        text_en_h = bbox_en[3] - bbox_en[1]
        text_en_y = text_cn_y + text_cn_h + 30  # 中文下方 30px
        
        draw.text(
            (centerX - text_en_w // 2, text_en_y), 
            text_en, 
            fill='white', 
            font=font_text_en
        )
    
    # 儲存
    filename = f'richmenu_{scheme}.png'
    img.save(filename, 'PNG', optimize=True, quality=95)
    print(f'✅ 已儲存: {filename}')
    
    return filename

if __name__ == '__main__':
    print('🚀 開始生成 Rich Menu 圖片（純文字版）...\n')
    
    # 檢查是否有中文字體
    if not find_chinese_font():
        print("\n❌ 找不到中文字體！")
        print("請執行：sudo apt install fonts-noto-cjk")
        exit(1)
    
    # 生成所有配色
    success_count = 0
    for scheme in ['purple', 'green', 'blue', 'dark']:
        result = create_richmenu(scheme)
        if result:
            success_count += 1
    
    if success_count > 0:
        print(f'\n🎉 完成！已生成 {success_count} 張圖片')
        print('\n📁 檔案列表：')
        for scheme in ['purple', 'green', 'blue', 'dark']:
            filename = f'richmenu_{scheme}.png'
            if os.path.exists(filename):
                size = os.path.getsize(filename) / 1024
                print(f'  ✓ {filename} ({size:.1f} KB)')
        
        print('\n✅ 特色：')
        print('  • 無 Emoji，純文字設計')
        print('  • 中文 90px，英文 45px')
        print('  • 中英文間距 30px')
        print('  • 簡潔專業風格')