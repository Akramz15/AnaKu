import os
import re

files = [
    'frontend/src/pages/parent/Gallery.jsx',
    'frontend/src/pages/parent/Billing.jsx',
    'frontend/src/pages/parent/ParentChat.jsx',
    'frontend/src/pages/caregiver/DailyLogForm.jsx',
    'frontend/src/pages/caregiver/GalleryUpload.jsx',
    'frontend/src/pages/caregiver/CaregiverChat.jsx',
    'frontend/src/pages/admin/ChildrenManagement.jsx',
    'frontend/src/pages/admin/QRGenerator.jsx',
    'frontend/src/pages/admin/QRScanner.jsx',
    'frontend/src/pages/admin/BillingManagement.jsx'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'import PageLayout' in content:
        continue
        
    lines = content.split('\n')
    
    import_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('import'):
            import_idx = i
            
    lines.insert(import_idx + 1, "import PageLayout from '../../components/layout/PageLayout'")
    
    new_content = '\n'.join(lines)
    
    new_content = re.sub(r'(return\s*\(\s*)(<div[^>]*>)', r'\1<PageLayout>\n      \2', new_content, count=1)
    
    parts = new_content.rsplit(')', 1)
    if len(parts) == 2:
        new_content = parts[0] + '    </PageLayout>\n  )' + parts[1]
        
    with open(file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'Processed {file}')
