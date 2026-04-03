with open('/mnt/c/source/appraisal-management-backend/src/types/index.ts', 'rb') as f:
    content = f.read()

injection = b"// ProductType is used by several interfaces defined directly in this file.\r\nimport type { ProductType } from './product-catalog.js';\r\n\r\n"

if content.startswith(b'\xef\xbb\xbf'):
    content = content[:3] + injection + content[3:]
else:
    content = injection + content

with open('/mnt/c/source/appraisal-management-backend/src/types/index.ts', 'wb') as f:
    f.write(content)

print('Done')
