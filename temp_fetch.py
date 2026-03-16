import urllib.request
import urllib.error
import ssl
import re

url = 'https://www.hydroquebec.com/production/centrales.html'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx) as response:
        html = response.read().decode('utf-8')
        
    # extract image links
    imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html)
    res = [img for img in imgs if 'centrale' in img.lower() or 'production' in img.lower() or '.jpg' in img.lower()]
    print("Found images:", list(set(res))[:30])
except Exception as e:
    print("Error:", e)
