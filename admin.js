    // Paste your Google Sheets Web App URL here as a hardcoded fallback
    const DEFAULT_GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzH8TL29xMHAJ3LuwID751ifsOeS1wb7Bi28AtmHV1osLvxa9-SYFov5rGXET-zk_cvMw/exec";

    // Read URL from localStorage or use default fallback
    let GOOGLE_SHEET_URL = localStorage.getItem('google_sheet_url') || DEFAULT_GOOGLE_SHEET_URL;

    let allOrders = [];
    let allColors = [];
    let selectedOrder = null;
    let selectedArtworkFile = null;

    // View Navigation Tabs
    function loadTab(tabName) {
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('btn-tab-' + tabName).classList.add('active');

      document.getElementById('tab-orders').style.display = 'none';
      document.getElementById('tab-colors').style.display = 'none';
      document.getElementById('tab-config').style.display = 'none';
      document.getElementById('tab-billing').style.display = 'none';

      if (tabName === 'orders') {
        document.getElementById('tab-orders').style.display = 'block';
        fetchOrders();
      } else if (tabName === 'colors') {
        document.getElementById('tab-colors').style.display = 'block';
        fetchColors();
      } else if (tabName === 'billing') {
        document.getElementById('tab-billing').style.display = 'block';
        initializeBillingTab();
      } else {
        document.getElementById('tab-config').style.display = 'block';
        fetchConfig();
      }
    }

    // Helper to check if Google Sheets Web App URL is set
    function checkUrl() {
      if (!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_SHEET_WEB_APP_URL")) {
        alert('กรุณากรอก Google Sheets Web App URL ในแท็บ "ตั้งค่าระบบ" ก่อนใช้งาน');
        loadTab('config');
        return false;
      }
      return true;
    }

    // Fetch orders from Google Sheets API
    async function fetchOrders() {
      if (!checkUrl()) return;

      try {
        const response = await fetch(GOOGLE_SHEET_URL + '?action=getOrders', { redirect: 'follow' });
        if (response.ok) {
          allOrders = await response.json();
          updateStats();
          filterOrders();
        } else {
          console.error('Failed to fetch orders');
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      }
    }

    // Update Statistics summary
    function updateStats() {
      const total = allOrders.length;
      const pending = allOrders.filter(o => o.status === 'รอดำเนินการ').length;
      const progress = allOrders.filter(o => o.status === 'กำลังผลิต').length;
      const completed = allOrders.filter(o => o.status === 'เสร็จสิ้นแล้ว').length;

      document.getElementById('stat-total').innerText = total;
      document.getElementById('stat-pending').innerText = pending;
      document.getElementById('stat-progress').innerText = progress;
      document.getElementById('stat-completed').innerText = completed;
    }

    // Filter and search orders in the UI table
    function filterOrders() {
      const searchQuery = document.getElementById('search-input').value.toLowerCase();
      const statusFilter = document.getElementById('status-filter').value;
      const dateFilter = document.getElementById('date-filter').value;

      const filtered = allOrders.filter(order => {
        // Search filter
        const matchSearch = 
          order.customerName.toLowerCase().includes(searchQuery) ||
          (order.groomName && order.groomName.toLowerCase().includes(searchQuery)) ||
          (order.brideName && order.brideName.toLowerCase().includes(searchQuery)) ||
          order.id.toString().includes(searchQuery);

        // Status filter
        const matchStatus = statusFilter === 'all' || order.status === statusFilter;

        // Date filter
        const matchDate = !dateFilter || order.requiredDate === dateFilter;

        return matchSearch && matchStatus && matchDate;
      });

      renderTable(filtered);
    }

    // Clear all filters
    function clearFilters() {
      document.getElementById('search-input').value = '';
      document.getElementById('status-filter').value = 'all';
      document.getElementById('date-filter').value = '';
      filterOrders();
    }

    // Render filtered orders into the HTML table
    function renderTable(orders) {
      const tbody = document.getElementById('orders-table-body');
      tbody.innerHTML = '';

      if (orders.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">ไม่พบข้อมูลรายการสั่งตัดตามตัวกรอง</td>
          </tr>
        `;
        return;
      }

      // Sort by id (descending to show new orders first)
      orders.sort((a, b) => b.id - a.id);

      orders.forEach(order => {
        const tr = document.createElement('tr');
        
        let statusClass = 'pending';
        if (order.status === 'กำลังผลิต') statusClass = 'progress';
        if (order.status === 'เสร็จสิ้นแล้ว') statusClass = 'completed';

        // Format Bride and Groom names
        let weddingNames = "";
        if (order.brideName === '[งานบวช]') {
          weddingNames = `👶 งานบวช: นาค ${order.groomName || '-'}`;
        } else if (order.groomName || order.brideName) {
          weddingNames = `🤵 ${order.groomName || '-'} & 👰 ${order.brideName || '-'}`;
        } else {
          weddingNames = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">ไม่มีระบุ (โลโก้ทั่วไป)</span>';
        }

        tr.innerHTML = `
          <td data-label="รหัสสั่งตัด" style="font-family: 'Outfit', sans-serif; font-weight: 600;">#${order.id}</td>
          <td data-label="ชื่อผู้สั่ง" style="font-weight: 500;">${order.customerName}</td>
          <td data-label="รายละเอียด">${weddingNames}</td>
          <td data-label="วันที่ใช้" style="color: var(--accent-color); font-weight: 500;">${formatThaiDate(order.requiredDate)}</td>
          <td data-label="ขนาด">${order.size}</td>
          <td data-label="สี">${order.color}</td>
          <td data-label="สถานะ"><span class="badge ${statusClass}">${order.status}</span></td>
          <td data-label="การจัดการ">
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; width: 100%;">
              <button class="btn btn-gold btn-action" onclick="openOrderModal(${order.id})" style="flex: 1; text-align: center;">🔍 เปิด</button>
              <button class="btn btn-danger btn-action" onclick="deleteOrder(${order.id})">🗑️ ลบ</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    function getDirectImageUrl(url) {
      if (!url) return '';
      const match = url.match(/\/file\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
      return url;
    }

    function formatThaiDate(dateString) {
      if (!dateString) return '-';
      try {
        if (dateString.includes('T')) {
          dateString = dateString.split('T')[0];
        }
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        return `${parts[2]}/${parts[1]}/${parseInt(parts[0]) + 543}`;
      } catch (e) {
        return dateString;
      }
    }

    // Modal Control and job sheet mapping
    function openOrderModal(orderId) {
      selectedOrder = allOrders.find(o => o.id === orderId);
      if (!selectedOrder) return;

      document.getElementById('modal-title').innerText = `รายละเอียดใบสั่งตัด #${selectedOrder.id}`;
      document.getElementById('modal-status-select').value = selectedOrder.status;

      // Map details to printable Job Sheet
      document.getElementById('sheet-order-id').innerText = `#${selectedOrder.id}`;
      
      let createdDateDisplay = selectedOrder.createdDate || '-';
      if (createdDateDisplay && createdDateDisplay !== '-' && (createdDateDisplay.includes('-') || createdDateDisplay.includes('/'))) {
        let normalized = createdDateDisplay.replace('T', ' ');
        if (normalized.includes('.')) {
          normalized = normalized.split('.')[0];
        } else if (normalized.endsWith('Z')) {
          normalized = normalized.substring(0, normalized.length - 1);
        }
        const parts = normalized.split(' ');
        const datePart = parts[0];
        const timePart = parts[1] || '';
        const dParts = datePart.includes('-') ? datePart.split('-') : datePart.split('/');
        if (dParts.length === 3) {
          if (parseInt(dParts[0]) > 2500 || parseInt(dParts[2]) > 2500) {
            createdDateDisplay = normalized;
          } else {
            createdDateDisplay = `${dParts[2]}/${dParts[1]}/${parseInt(dParts[0]) + 543}${timePart ? ' ' + timePart : ''}`;
          }
        }
      }
      document.getElementById('sheet-created-date').innerText = createdDateDisplay;
      
      const formattedDate = formatThaiDate(selectedOrder.requiredDate);
      document.getElementById('sheet-required-date').innerText = formattedDate;
      const specRequiredDateEl = document.getElementById('sheet-spec-required-date');
      if (specRequiredDateEl) specRequiredDateEl.innerText = formattedDate;
      document.getElementById('sheet-customer-name').innerText = selectedOrder.customerName;
      // Parse bracketed metadata from notes
      const notesVal = selectedOrder.notes || '';
      const materialMatch = notesVal.match(/\[วัสดุ:\s*([^\]]+)\]/);
      const material = materialMatch ? materialMatch[1] : 'รองโฟม'; 

      const symbolMatch = notesVal.match(/\[สัญลักษณ์:\s*([^\]]+)\]/);
      const symbol = symbolMatch ? symbolMatch[1] : '';

      const cleanNotes = notesVal.replace(/\[วัสดุ:\s*[^\]]+\]\s*/g, '').replace(/\[สัญลักษณ์:\s*[^\]]+\]\s*/g, '').trim();

      document.getElementById('sheet-material').innerText = material;
      const symbolRow = document.getElementById('sheet-symbol-row');
      if (symbolRow) {
        if (symbol) {
          document.getElementById('sheet-symbol').innerText = symbol;
          symbolRow.style.display = 'flex';
        } else {
          symbolRow.style.display = 'none';
        }
      }

      if (selectedOrder.brideName === '[งานบวช]') {
        document.getElementById('sheet-group-title-1').innerText = "👤 ข้อมูลผู้สั่งและงานอุปสมบท";
        document.getElementById('sheet-groom-label').innerText = "ชื่อนาค:";
        document.getElementById('sheet-groom-name').innerText = selectedOrder.groomName || '-';
        document.getElementById('sheet-bride-row').style.display = 'none';
      } else {
        document.getElementById('sheet-group-title-1').innerText = "👤 ข้อมูลผู้สั่งและงานแต่ง";
        document.getElementById('sheet-groom-label').innerText = "ชื่อเจ้าบ่าว:";
        document.getElementById('sheet-groom-name').innerText = selectedOrder.groomName || '-';
        document.getElementById('sheet-bride-row').style.display = 'flex';
        document.getElementById('sheet-bride-name').innerText = selectedOrder.brideName || '-';
      }
      document.getElementById('sheet-size').innerText = selectedOrder.size;
      document.getElementById('sheet-color').innerText = selectedOrder.color;
      document.getElementById('sheet-notes').innerText = cleanNotes || '-';

            // Load Images
      const imgContainer = document.getElementById('sheet-images-container');
      imgContainer.innerHTML = '';
      
      if (selectedOrder.images && selectedOrder.images.length > 0) {
        selectedOrder.images.forEach(imgUrl => {
          const wrapper = document.createElement('div');
          wrapper.className = 'job-sheet-image-wrapper';
          const directUrl = getDirectImageUrl(imgUrl);
          wrapper.innerHTML = `<img src="${directUrl}" alt="Foam logo sample image" onclick="window.open('${directUrl}')" style="cursor: pointer;">`;
          imgContainer.appendChild(wrapper);
        });
      } else {
        imgContainer.innerHTML = '<div style="color: #666; font-style: italic;">ไม่มีการอัปโหลดรูปภาพ</div>';
      }

      // Load Artwork
      const artworkContainer = document.getElementById('sheet-artwork-container');
      if (artworkContainer) {
        artworkContainer.innerHTML = '';
        
        const uploadControls = document.getElementById('artwork-upload-controls');
        const deleteControls = document.getElementById('artwork-delete-controls');
        const fileInput = document.getElementById('artwork-file-input');
        const uploadBtn = document.getElementById('btn-upload-artwork');
        
        if (fileInput) fileInput.value = '';
        if (uploadBtn) uploadBtn.style.display = 'none';
        selectedArtworkFile = null;
        
        if (selectedOrder.artwork) {
          const wrapper = document.createElement('div');
          wrapper.className = 'job-sheet-image-wrapper';
          const directUrl = getDirectImageUrl(selectedOrder.artwork);
          wrapper.innerHTML = `<img src="${directUrl}" alt="Artwork" onclick="window.open('${directUrl}')" style="cursor: pointer; border: 2px solid #0ea5e9;">`;
          artworkContainer.appendChild(wrapper);
          
          if (uploadControls) uploadControls.style.display = 'none';
          if (deleteControls) deleteControls.style.display = 'flex';
        } else {
          artworkContainer.innerHTML = '<div style="color: #666; font-style: italic;">ยังไม่ได้อัปโหลดแบบงาน Artwork</div>';
          
          if (uploadControls) uploadControls.style.display = 'flex';
          if (deleteControls) deleteControls.style.display = 'none';
        }
      }

      document.getElementById('order-modal').classList.add('active');
    }

        function closeModal() {
      document.getElementById('order-modal').classList.remove('active');
      selectedOrder = null;
    }

    function handleArtworkSelect(event) {
      const file = event.target.files[0];
      if (file) {
        selectedArtworkFile = file;
        const textDisplay = document.getElementById('artwork-filename-display');
        if (textDisplay) textDisplay.innerText = file.name;
        const uploadBtn = document.getElementById('btn-upload-artwork');
        if (uploadBtn) uploadBtn.style.display = 'inline-flex';
      }
    }
    window.handleArtworkSelect = handleArtworkSelect;

    async function uploadArtworkImage() {
      if (!selectedOrder) return;
      if (!selectedArtworkFile) {
        alert("กรุณาเลือกไฟล์ภาพแบบงาน (Artwork) ก่อนครับ");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async function(e) {
        const base64Data = e.target.result;
        const btn = document.getElementById('btn-upload-artwork');
        const origText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "⏳ อัปโหลด...";
        
        try {
          const response = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            body: JSON.stringify({
              action: 'updateArtwork',
              id: selectedOrder.id,
              artworkData: base64Data,
              filename: selectedArtworkFile.name
            }),
            redirect: 'follow'
          });
          
          if (response.ok) {
            const res = await response.json();
            if (res.success) {
              alert("อัปโหลดแบบงาน Artwork สำเร็จ!");
              selectedOrder.artwork = res.artwork;
              // Refresh data
              await fetchOrders();
              openOrderModal(selectedOrder.id);
            } else {
              alert("อัปโหลดล้มเหลว: " + res.error);
            }
          } else {
            alert("เชื่อมต่อเซิร์ฟเวอร์ผิดพลาด");
          }
        } catch (err) {
          console.error(err);
          alert("เกิดข้อผิดพลาดในการอัปโหลด");
        } finally {
          btn.disabled = false;
          btn.innerText = origText;
        }
      };
      reader.readAsDataURL(selectedArtworkFile);
    }
    window.uploadArtworkImage = uploadArtworkImage;

    async function deleteArtworkImage() {
      if (!selectedOrder) return;
      if (!confirm("คุณต้องการลบรูปภาพแบบงาน (Artwork) ออกใช่หรือไม่?")) return;
      
      const btn = document.querySelector('button[onclick="deleteArtworkImage()"]');
      const origText = btn ? btn.innerText : '';
      if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ กำลังลบ...";
      }
      
      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'updateArtwork',
            id: selectedOrder.id,
            artworkData: ""
          }),
          redirect: 'follow'
        });
        
        if (response.ok) {
          const res = await response.json();
          if (res.success) {
            alert("ลบรูปภาพแบบงานสำเร็จ!");
            selectedOrder.artwork = "";
            await fetchOrders();
            openOrderModal(selectedOrder.id);
          } else {
            alert("ลบล้มเหลว: " + res.error);
          }
        } else {
          alert("เชื่อมต่อเซิร์ฟเวอร์ผิดพลาด");
        }
      } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการลบแบบงาน");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerText = origText;
        }
      }
    }
    window.deleteArtworkImage = deleteArtworkImage;

    // Update order status call
    async function updateOrderStatus() {
      if (!selectedOrder) return;
      if (!checkUrl()) return;
      
      const newStatus = document.getElementById('modal-status-select').value;
      
      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'updateStatus',
            id: selectedOrder.id,
            status: newStatus
          }),
          redirect: 'follow'
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            selectedOrder.status = newStatus;
            fetchOrders();
            closeModal();
            alert('อัปเดตสถานะสำเร็จ!');
          } else {
            alert('เกิดข้อผิดพลาด: ' + resJson.error);
          }
        } else {
          alert('ไม่สามารถเชื่อมต่อ Google Sheets API ได้');
        }
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์');
      }
    }

    // Delete order logic
    async function deleteOrder(orderId) {
      if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบคำสั่งสั่งตัด #${orderId}?`)) return;
      if (!checkUrl()) return;

      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'deleteOrder',
            id: orderId
          }),
          redirect: 'follow'
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            fetchOrders();
            alert('ลบข้อมูลสำเร็จ!');
          } else {
            alert('เกิดข้อผิดพลาด: ' + resJson.error);
          }
        } else {
          alert('ไม่สามารถเชื่อมต่อ Google Sheets API ได้');
        }
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์');
      }
    }

    // Colors list logic
    async function fetchColors() {
      if (!checkUrl()) return;

      try {
        const response = await fetch(GOOGLE_SHEET_URL + '?action=getColors', { redirect: 'follow' });
        if (response.ok) {
          allColors = await response.json();
          renderColorsTable();
        }
      } catch (err) {
        console.error('Error fetching colors:', err);
      }
    }

    function renderColorsTable() {
      const tbody = document.getElementById('colors-list-body');
      tbody.innerHTML = '';

      if (allColors.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="2" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">ไม่มีเฉดสีในตัวเลือกในขณะนี้</td>
          </tr>
        `;
        return;
      }

      allColors.forEach(color => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight: 500; font-size: 0.95rem; padding: 0.75rem 1rem;">${color}</td>
          <td style="text-align: right; padding: 0.75rem 1rem;">
            <button class="btn btn-danger btn-action" onclick="deleteColor('${color}')">🗑️ ลบเฉดสี</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    async function addNewColor() {
      const input = document.getElementById('new-color-input');
      const colorVal = input.value.trim();

      if (!colorVal) {
        alert('กรุณากรอกชื่อเฉดสีที่ต้องการเพิ่ม');
        return;
      }
      if (!checkUrl()) return;

      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'addColor',
            color: colorVal
          }),
          redirect: 'follow'
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            input.value = '';
            fetchColors();
            alert('เพิ่มเฉดสีสำเร็จ!');
          } else {
            alert('เกิดข้อผิดพลาด: ' + resJson.error);
          }
        } else {
          alert('ไม่สามารถเชื่อมต่อ Google Sheets API ได้');
        }
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์');
      }
    }

    async function deleteColor(colorName) {
      if (!confirm(`คุณต้องการลบเฉดสี "${colorName}" ใช่หรือไม่?\nการลบนี้จะส่งผลกับเฉดสีที่จะเลือกหน้าลูกค้า แต่ไม่มีผลย้อนหลังกับใบสั่งงานที่สั่งไปแล้ว`)) return;
      if (!checkUrl()) return;

      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'deleteColor',
            color: colorName
          }),
          redirect: 'follow'
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            fetchColors();
            alert('ลบเฉดสีสำเร็จ!');
          } else {
            alert('เกิดข้อผิดพลาด: ' + resJson.error);
          }
        } else {
          alert('ไม่สามารถเชื่อมต่อ Google Sheets API ได้');
        }
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์');
      }
    }

    // Config Fetch & Save with QR Upload
    let tempQrImage = null;

    function handleQrFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        tempQrImage = {
          filename: file.name,
          data: e.target.result
        };
        
        // Update local preview
        const imgPreview = document.getElementById('payment-qr-preview');
        imgPreview.src = e.target.result;
        document.getElementById('payment-qr-preview-container').style.display = 'block';
        document.getElementById('payment-qr-url').value = file.name + ' (รอกดบันทึกเพื่ออัปโหลด)';
      };
      reader.readAsDataURL(file);
    }

    window.handleQrFileSelect = handleQrFileSelect;

    async function fetchConfig() {
      // Set the active Web App URL value in the input field
      document.getElementById('google-sheet-url').value = GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_SHEET_WEB_APP_URL") ? "" : GOOGLE_SHEET_URL;

      if (!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_SHEET_WEB_APP_URL")) {
        document.getElementById('google-sheet-sync-enabled').checked = false;
        return; // Skip reading from sheet since URL is not set
      }

      try {
        const response = await fetch(GOOGLE_SHEET_URL + '?action=getConfig', { redirect: 'follow' });
        if (response.ok) {
          const config = await response.json();
          document.getElementById('line-notify-enabled').checked = config.lineNotifyEnabled;
          document.getElementById('line-token').value = config.lineChannelAccessToken || '';
          document.getElementById('line-recipient').value = config.lineRecipientId || '';
          
          // Split fields
          document.getElementById('payment-bank').value = config.paymentBank || '';
          document.getElementById('payment-account-number').value = config.paymentAccountNumber || '';
          document.getElementById('payment-account-name').value = config.paymentAccountName || '';
          document.getElementById('payment-qr-url').value = config.paymentQrUrl || '';
          
          // Update QR Code Preview
          if (config.paymentQrUrl) {
            const directUrl = getDirectImageUrl(config.paymentQrUrl);
            document.getElementById('payment-qr-preview').src = directUrl;
            document.getElementById('payment-qr-preview-container').style.display = 'block';
          } else {
            document.getElementById('payment-qr-preview-container').style.display = 'none';
          }
          
          document.getElementById('google-sheet-sync-enabled').checked = true;
        }
      } catch (err) {
        console.error('Error fetching config:', err);
      }
    }

    async function saveConfig(e) {
      e.preventDefault();

      const webAppUrl = document.getElementById('google-sheet-url').value.trim();
      if (!webAppUrl) {
        alert('กรุณากรอก Google Sheets Web App URL');
        return;
      }

      // Save to localStorage
      localStorage.setItem('google_sheet_url', webAppUrl);
      GOOGLE_SHEET_URL = webAppUrl;

      // Disable button during saving upload
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = 'กำลังบันทึกและอัปโหลดคิวอาร์...';

      const config = {
        action: 'saveConfig',
        lineNotifyEnabled: document.getElementById('line-notify-enabled').checked,
        lineChannelAccessToken: document.getElementById('line-token').value,
        lineRecipientId: document.getElementById('line-recipient').value,
        paymentBank: document.getElementById('payment-bank').value.trim(),
        paymentAccountNumber: document.getElementById('payment-account-number').value.trim(),
        paymentAccountName: document.getElementById('payment-account-name').value.trim(),
        paymentQrUrl: document.getElementById('payment-qr-url').value.trim(),
        qrImage: tempQrImage
      };

      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify(config),
          redirect: 'follow'
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            alert('บันทึกการตั้งค่าระบบและอัปโหลดข้อมูลชำระเงินเรียบร้อยแล้ว!');
            tempQrImage = null; // Clear upload buffer
            fetchConfig();
          } else {
            alert('บันทึกที่คิวเครื่องได้ แต่ไม่สามารถบันทึกไปคลาวด์ได้: ' + resJson.error);
          }
        } else {
          alert('บันทึก URL ในบราวเซอร์แล้ว แต่มีปัญหาในการเชื่อมต่อไปยัง Google Sheets');
        }
      } catch (err) {
        console.error(err);
        alert('บันทึกสำเร็จในระบบเบราว์เซอร์ แต่ไม่สามารถเชื่อมต่อคลาวด์ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    }

    async function testLineNotification() {
      if (!checkUrl()) return;

      const config = {
        action: 'saveConfig',
        lineNotifyEnabled: document.getElementById('line-notify-enabled').checked,
        lineChannelAccessToken: document.getElementById('line-token').value,
        lineRecipientId: document.getElementById('line-recipient').value,
        isTest: true
      };

      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify(config),
          redirect: 'follow'
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            alert('ส่งการแจ้งเตือนทดสอบไปที่ LINE เรียบร้อยแล้ว! กรุณาตรวจสอบโทรศัพท์ของคุณ');
          } else {
            alert('ส่งการแจ้งเตือนทดสอบล้มเหลว: ' + resJson.error);
          }
        } else {
          alert('เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets API');
        }
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์');
      }
    }

    // Billing Tab Logic
    let activeBillItems = [];
    let editingBillId = null;

    function initializeBillingTab() {
      // Set bill date to today
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      document.getElementById('bill-date').value = `${year}-${month}-${day}`;
      
      // Clear billing search and populate left table
      document.getElementById('billing-search').value = '';
      populateBillingOrdersTable();
    }

    window.initializeBillingTab = initializeBillingTab;

    function populateBillingOrdersTable() {
      const tbody = document.getElementById('billing-orders-list');
      tbody.innerHTML = '';
      
      if (!allOrders || allOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">ไม่มีข้อมูลคำสั่งตัด</td></tr>';
        return;
      }
      
      // Display orders sorted by id descending
      const sortedOrders = [...allOrders].sort((a, b) => b.id - a.id);
      
      sortedOrders.forEach(order => {
        const tr = document.createElement('tr');
        tr.className = 'billing-order-row';
        tr.setAttribute('data-customer', order.customerName.toLowerCase());
        
        let details = "";
        if (order.brideName === '[งานบวช]') {
          details = `งานบวช: นาค ${order.groomName}`;
        } else if (order.brideName && order.groomName) {
          details = `${order.groomName} & ${order.brideName}`;
        } else {
          details = "โลโก้ทั่วไป";
        }
        
        // Strip bracket tags from display notes
        const notesText = order.notes || '';
        const cleanNotes = notesText.replace(/\[วัสดุ:\s*[^\]]+\]\s*/g, '').replace(/\[สัญลักษณ์:\s*[^\]]+\]\s*/g, '').trim();
        if (cleanNotes) details += ` (${cleanNotes})`;

        // Size and Color
        const sizeVal = order.size || '';
        const colorVal = order.color || '';
        const specs = `${sizeVal} / สี: ${colorVal}`;

        // Check if already in bill
        const isInBill = activeBillItems.some(item => item.id === order.id);
        const actionBtn = isInBill 
          ? `<button class="btn btn-outline" onclick="removeOrderFromBill(${order.id})" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-color: #ef4444; color: #ef4444;">✕ ลบออก</button>`
          : `<button class="btn btn-gold" onclick="addOrderToBill(${order.id})" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">➕ เพิ่มเข้าบิล</button>`;

        tr.innerHTML = `
          <td><strong>#${order.id}</strong></td>
          <td>${order.customerName}</td>
          <td style="font-size: 0.82rem; color: var(--text-muted);">
            <div>${details}</div>
            <div style="margin-top: 0.15rem; color: var(--accent-color); font-weight: 500;">${specs}</div>
          </td>
          <td style="text-align: center; white-space: nowrap;">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    window.populateBillingOrdersTable = populateBillingOrdersTable;

    function filterBillingOrders() {
      const query = document.getElementById('billing-search').value.toLowerCase().trim();
      const rows = document.querySelectorAll('.billing-order-row');
      
      rows.forEach(row => {
        const customer = row.getAttribute('data-customer') || '';
        const textContent = row.textContent.toLowerCase();
        if (customer.includes(query) || textContent.includes(query)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    window.filterBillingOrders = filterBillingOrders;

    function getFinishedImageForPiece(item) {
      if (!item.finishedImage) return '';
      const urls = String(item.finishedImage).split(',').map(s => s.trim());
      return urls[item.pieceIndex - 1] || '';
    }

    window.getFinishedImageForPiece = getFinishedImageForPiece;

    function addOrderToBill(orderId) {
      const order = allOrders.find(o => o.id === orderId);
      if (!order) return;
      
      const sizeStr = order.size || '';
      const qtyMatch = sizeStr.match(/จำนวน:\s*(\d+)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
      
      const cleanSize = sizeStr.replace(/\s*\(จำนวน:\s*\d+\s*ชิ้น\)/i, "");
      const sizeParts = cleanSize.split(/ชิ้นที่\s*\d+:\s*/).map(s => s.trim().replace(/,$/, "").replace(/,$/, "")).filter(Boolean);
      
      const colorStr = order.color || '';
      const colorParts = colorStr.split(/ชิ้นที่\s*\d+:\s*/).map(c => c.trim().replace(/,$/, "").replace(/,$/, "")).filter(Boolean);
      
      if (qty > 1) {
        for (let i = 0; i < qty; i++) {
          const pieceId = `${orderId}_${i + 1}`;
          if (activeBillItems.some(item => item.billItemId === pieceId)) continue;
          
          const pieceSize = sizeParts[i] || sizeParts[0] || cleanSize || '-';
          const pieceColor = colorParts[i] || colorParts[0] || colorStr || '-';
          
          activeBillItems.push({
            ...order,
            billItemId: pieceId,
            pieceIndex: i + 1,
            pieceSize: pieceSize,
            pieceColor: pieceColor,
            billPrice: 0
          });
        }
      } else {
        const pieceId = `${orderId}_1`;
        if (activeBillItems.some(item => item.billItemId === pieceId)) return;
        
        activeBillItems.push({
          ...order,
          billItemId: pieceId,
          pieceIndex: 1,
          pieceSize: cleanSize || '-',
          pieceColor: colorStr || '-',
          billPrice: 0
        });
      }
      
      // Auto populate customer name if first item
      const custNameInput = document.getElementById('bill-customer-name');
      if (activeBillItems.length > 0 && !custNameInput.value.trim()) {
        custNameInput.value = order.customerName;
      }
      
      updateActiveBillTable();
      populateBillingOrdersTable(); // Refresh Left column buttons
    }

    window.addOrderToBill = addOrderToBill;

    function removeOrderFromBill(orderId) {
      activeBillItems = activeBillItems.filter(item => item.id !== orderId);
      updateActiveBillTable();
      populateBillingOrdersTable(); // Refresh Left column buttons
    }

    window.removeOrderFromBill = removeOrderFromBill;

    function updateActiveBillTable() {
      const tbody = document.getElementById('active-bill-items');
      tbody.innerHTML = '';
      
      if (activeBillItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">กรุณาเลือกรายการชิ้นงานจากฝั่งซ้ายเพิ่มเข้ามาในบิล</td></tr>';
        document.getElementById('bill-subtotal').innerText = '0';
        document.getElementById('bill-total').innerText = '0';
        return;
      }
      
      activeBillItems.forEach(item => {
        const tr = document.createElement('tr');
        
        let desc = "";
        if (item.brideName === '[งานบวช]') {
          desc = `งานตัดโฟมงานบวช: นาค ${item.groomName} (ชิ้นที่ ${item.pieceIndex})`;
        } else if (item.brideName && item.groomName) {
          desc = `งานตัดโฟมแต่งงาน: ${item.groomName} & ${item.brideName} (ชิ้นที่ ${item.pieceIndex})`;
        } else {
          desc = `งานตัดป้ายโลโก้โฟม:ทั่วไป (#${item.id}) (ชิ้นที่ ${item.pieceIndex})`;
        }
        
        // Parse materials backing from notes
        const notesVal = item.notes || '';
        const materialMatch = notesVal.match(/\[วัสดุ:\s*([^\]]+)\]/);
        const material = materialMatch ? materialMatch[1] : 'รองโฟม'; 
        
        const specs = `${item.pieceSize} (${material}) / สี: ${item.pieceColor}`;
        
        // Finished Image Slot
        const pieceImgUrl = getFinishedImageForPiece(item);
        const imgDirectUrl = pieceImgUrl ? getDirectImageUrl(pieceImgUrl) : '';
        const imgHtml = imgDirectUrl
          ? `<img src="${imgDirectUrl}" style="width: 45px; height: 45px; object-fit: contain; border-radius: 4px; border: 1.5px solid var(--border-color); background: #fff; cursor: pointer; display: block; margin: 0 auto;" onclick="window.open('${imgDirectUrl}')">`
          : `<span style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">ยังไม่มีรูป</span>`;

        const btnHtml = imgDirectUrl
          ? `<button class="btn btn-outline" onclick="deleteSingleFinishedImage(${item.id}, ${item.pieceIndex})" style="padding: 2px 6px; font-size: 0.65rem; margin-top: 3px; border-color: #ef4444; color: #ef4444; display: block; margin: 3px auto 0 auto;">🗑️ ลบรูป</button>`
          : `<button class="btn btn-outline" onclick="document.getElementById('finished-file-${item.id}-${item.pieceIndex}').click()" style="padding: 2px 6px; font-size: 0.65rem; margin-top: 3px; border-color: var(--accent-color); color: var(--accent-color); display: block; margin: 3px auto 0 auto;">📁 รูปเสร็จ</button>`;

        tr.innerHTML = `
          <td>
            <div style="font-weight: 600;">${desc}</div>
            <div style="font-size: 0.72rem; color: #a1a1aa; margin-top: 0.15rem;">รหัสชิ้นงาน: #${item.id}</div>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${specs}</td>
          <td style="text-align: center; vertical-align: middle;">
            <div id="finished-preview-container-${item.id}-${item.pieceIndex}" style="min-height: 45px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
              ${imgHtml}
            </div>
            <input type="file" id="finished-file-${item.id}-${item.pieceIndex}" accept="image/*" onchange="handleFinishedImageUpload(${item.id}, ${item.pieceIndex}, event)" style="display: none;">
            ${btnHtml}
          </td>
          <td style="text-align: right;">
            <input type="number" id="bill-price-${item.billItemId}" class="filter-select bill-item-price" value="${item.billPrice}" min="0" oninput="updateItemPrice('${item.billItemId}', this.value)" style="width: 75px; text-align: right; padding: 0.25rem 0.4rem; font-size: 0.85rem; display: inline-block;">
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      calculateBillingTotal();
    }

    function handleFinishedImageUpload(orderId, pieceIndex, event) {
      const file = event.target.files[0];
      if (!file) return;

      const previewDiv = document.getElementById(`finished-preview-container-${orderId}-${pieceIndex}`);
      previewDiv.innerHTML = '<span style="font-size: 0.62rem; color: var(--accent-color); display: block; text-align: center; line-height: 1.2;">กำลังอัปโหลดรูป...</span>';

      const reader = new FileReader();
      reader.onload = async function(e) {
        const payload = {
          action: 'updateFinishedImage',
          id: orderId,
          pieceIndex: pieceIndex,
          image: {
            filename: file.name,
            data: e.target.result
          }
        };

        try {
          const response = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            redirect: 'follow'
          });

          if (response.ok) {
            const resJson = await response.json();
            if (resJson.success && resJson.finishedImage) {
              const updatedUrlList = resJson.finishedImage;
              
              // Update in activeBillItems
              activeBillItems.forEach(item => {
                if (item.id === orderId) {
                  item.finishedImage = updatedUrlList;
                }
              });
              
              // Update in allOrders
              const orderItem = allOrders.find(o => o.id === orderId);
              if (orderItem) orderItem.finishedImage = updatedUrlList;

              updateActiveBillTable();
              alert('อัปโหลดรูปชิ้นงานเสร็จแล้วเรียบร้อย!');
            } else {
              alert('อัปโหลดล้มเหลว: ' + resJson.error);
              updateActiveBillTable();
            }
          } else {
            alert('การเชื่อมต่อเซิร์ฟเวอร์ผิดพลาด');
            updateActiveBillTable();
          }
        } catch (err) {
          console.error(err);
          alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
          updateActiveBillTable();
        }
      };
      reader.readAsDataURL(file);
    }

    window.handleFinishedImageUpload = handleFinishedImageUpload;

    async function deleteSingleFinishedImage(orderId, pieceIndex) {
      if (!confirm('ยืนยันที่จะลบรูปผลงานเสร็จของรายการนี้เพื่อประหยัดพื้นที่เก็บข้อมูลคลาวด์?')) return;
      
      const previewDiv = document.getElementById(`finished-preview-container-${orderId}-${pieceIndex}`);
      previewDiv.innerHTML = '<span style="font-size: 0.62rem; color: #ef4444; display: block; text-align: center;">กำลังลบรูป...</span>';
      
      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'deleteFinishedImages',
            ids: [`${orderId}_${pieceIndex}`]
          }),
          redirect: 'follow'
        });
        
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            const updatedUrlList = resJson.finishedImage || '';
            
            // Update activeBillItems
            activeBillItems.forEach(item => {
              if (item.id === orderId) {
                item.finishedImage = updatedUrlList;
              }
            });
            
            // Update allOrders
            const orderItem = allOrders.find(o => o.id === orderId);
            if (orderItem) orderItem.finishedImage = updatedUrlList;
            
            updateActiveBillTable();
            alert('ลบรูปภาพผลงานชิ้นนี้ออกจากระบบสำเร็จ');
          } else {
            alert('ลบล้มเหลว: ' + resJson.error);
            updateActiveBillTable();
          }
        } else {
          alert('เชื่อมต่อเซิร์ฟเวอร์ผิดพลาด');
          updateActiveBillTable();
        }
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการส่งคำสั่งลบรูป');
        updateActiveBillTable();
      }
    }
    
    window.deleteSingleFinishedImage = deleteSingleFinishedImage;

    async function clearFinishedImagesFromServer(ids) {
      if (!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_SHEET_WEB_APP_URL")) {
        return;
      }
      
      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'deleteFinishedImages',
            ids: ids
          }),
          redirect: 'follow'
        });
        
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            // Reload all orders to sync everything
            await fetchOrders();
            // Clear finished image local state for matches
            activeBillItems.forEach(item => {
              const matchedOrder = allOrders.find(o => o.id === item.id);
              if (matchedOrder) {
                item.finishedImage = matchedOrder.finishedImage || '';
              }
            });
            updateActiveBillTable();
            alert(`ลบรูปภาพชิ้นงานเสร็จในระบบคลาวด์เรียบร้อยแล้วเพื่อประหยัดพื้นที่`);
          }
        }
      } catch (err) {
        console.error('Error deleting finished images:', err);
      }
    }
    
    window.clearFinishedImagesFromServer = clearFinishedImagesFromServer;

    function updateItemPrice(billItemId, val) {
      const price = parseFloat(val) || 0;
      const item = activeBillItems.find(i => i.billItemId === billItemId);
      if (item) {
        item.billPrice = price;
      }
      calculateBillingTotal();
    }

    window.updateItemPrice = updateItemPrice;

    function calculateBillingTotal() {
      let subtotal = 0;
      activeBillItems.forEach(item => {
        subtotal += item.billPrice;
      });
      
      const shipping = parseFloat(document.getElementById('bill-shipping').value) || 0;
      const discount = parseFloat(document.getElementById('bill-discount').value) || 0;
      const total = subtotal + shipping - discount;
      
      document.getElementById('bill-subtotal').innerText = subtotal.toLocaleString('th-TH');
      document.getElementById('bill-total').innerText = Math.max(0, total).toLocaleString('th-TH');
    }

    window.calculateBillingTotal = calculateBillingTotal;

    function clearActiveBill() {
      if (activeBillItems.length > 0 && !confirm("ต้องการล้างบิลนี้ใช่หรือไม่?")) return;
      activeBillItems = [];
      document.getElementById('bill-customer-name').value = '';
      document.getElementById('bill-shipping').value = '0';
      document.getElementById('bill-discount').value = '0';
      updateActiveBillTable();
      populateBillingOrdersTable();
    }

    window.clearActiveBill = clearActiveBill;

        function renderAndPrintInvoice(invoiceNo, customerName, displayDate, items, shipping, discount, total, payBank, payAccNum, payAccName, payQrUrl) {
      let itemRowsHtml = "";
      let subtotal = 0;
      
      items.forEach((item, index) => {
        const finishedImgDirectUrl = item.finishedImage ? getDirectImageUrl(item.finishedImage) : '';
        const price = item.price || 0;
        subtotal += price;
        
        itemRowsHtml += `
          <tr>
            <td style="text-align: center; border: 1px solid #ddd; padding: 8px; vertical-align: middle;">${index + 1}</td>
            <td style="border: 1px solid #ddd; padding: 8px; vertical-align: middle;">
              <table style="width: 100%; border-collapse: collapse; border: none; background: transparent;">
                <tr style="border: none; background: transparent;">
                  <td style="border: none; padding: 0; vertical-align: middle;">
                    <div style="font-weight: bold;">${item.desc}</div>
                    <div style="font-size: 0.8rem; color: #555; margin-top: 4px;">${item.specs}</div>
                  </td>
                  ${finishedImgDirectUrl ? `
                    <td style="border: none; padding: 0 0 0 10px; vertical-align: middle; text-align: right; width: 65px;">
                      <img src="${finishedImgDirectUrl}" alt="Finished Product" style="width: 60px; height: 60px; border: 1px solid #ddd; border-radius: 4px; object-fit: contain; background: #fff;">
                    </td>
                  ` : ''}
                </tr>
              </table>
            </td>
            <td style="text-align: center; border: 1px solid #ddd; padding: 8px; vertical-align: middle;">1</td>
            <td style="text-align: right; border: 1px solid #ddd; padding: 8px; vertical-align: middle;">${price.toLocaleString('th-TH')}.00</td>
            <td style="text-align: right; border: 1px solid #ddd; padding: 8px; vertical-align: middle;">${price.toLocaleString('th-TH')}.00</td>
          </tr>
        `;
      });
      
      const payQrDirectUrl = payQrUrl ? getDirectImageUrl(payQrUrl) : '';
      let payDetailsText = "";
      if (payBank) payDetailsText += `ธนาคาร: ${payBank}
`;
      if (payAccNum) payDetailsText += `เลขที่บัญชี: ${payAccNum}
`;
      if (payAccName) payDetailsText += `ชื่อบัญชี: ${payAccName}`;
      payDetailsText = payDetailsText.trim();
      
      const logoUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/โลโก้ใหม่.png';
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
        <head>
          <title>ใบสรุปรายการสินค้า #${invoiceNo}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;700;800&family=Outfit:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Sarabun', sans-serif;
              color: #1a1a1a;
              margin: 0;
              padding: 20px;
              background-color: #fff;
              line-height: 1.5;
            }
            .invoice-box {
              max-width: 800px;
              margin: auto;
              padding: 10px;
              background: #fff;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            .header-table td {
              padding: 0;
              vertical-align: middle;
            }
            .shop-logo {
              width: 75px;
              height: 75px;
              object-fit: contain;
              border-radius: 8px;
              margin-right: 15px;
              background: #fff;
              border: 1px solid #eaeaea;
            }
            .shop-name {
              font-size: 1.6rem;
              font-weight: 800;
              color: #b45309;
              margin: 0 0 3px 0;
              letter-spacing: 0.5px;
            }
            .shop-subtitle {
              font-size: 0.82rem;
              color: #6b7280;
              margin: 0;
            }
            .title-badge {
              background: #fef3c7;
              color: #b45309;
              font-weight: 800;
              padding: 8px 18px;
              font-size: 1.15rem;
              border-radius: 6px;
              text-align: center;
              border: 1px solid #fde68a;
              letter-spacing: 1px;
            }
            .metadata-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .metadata-table td {
              padding: 5px 8px;
              font-size: 0.9rem;
              border: none;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            .items-table th {
              background-color: #f8fafc;
              border: 1px solid #ddd;
              padding: 10px 8px;
              font-size: 0.9rem;
              font-weight: 700;
              color: #334155;
            }
            .items-table td {
              border: 1px solid #ddd;
              padding: 10px 8px;
              font-size: 0.88rem;
            }
            .totals-container {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            .totals-container td {
              padding: 4px 8px;
              font-size: 0.92rem;
            }
            .grand-total-row td {
              font-size: 1.25rem;
              font-weight: 800;
              color: #b45309;
              padding-top: 10px;
            }
            .payment-card {
              border: 1px solid #fde68a;
              border-radius: 8px;
              background-color: #fffdf5;
              padding: 12px;
              display: flex;
              align-items: center;
              gap: 15px;
              max-width: 420px;
            }
            .qr-code-img {
              width: 90px;
              height: 90px;
              object-fit: contain;
              border: 1px solid #fde68a;
              border-radius: 6px;
              background: #fff;
            }
            .payment-details {
              font-size: 0.88rem;
              color: #451a03;
              line-height: 1.45;
            }
            .signature-section {
              width: 100%;
              border-collapse: collapse;
              margin-top: 40px;
            }
            .signature-box {
              text-align: center;
              border-top: 1px dashed #cbd5e1;
              padding-top: 15px;
              font-size: 0.9rem;
              font-weight: 500;
            }
            @media print {
              body {
                padding: 0;
              }
              .invoice-box {
                padding: 0;
                border: none;
              }
              .payment-card {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            
            <!-- Logo and Shop Name Header -->
            <table class="header-table">
              <tr>
                <td style="width: 60%; display: flex; align-items: center;">
                  <img src="${logoUrl}" class="shop-logo" alt="Phat Flowers Logo" onerror="this.style.display='none'">
                  <div>
                    <h1 class="shop-name">ภัทรฟลาวเวอร์</h1>
                    <p class="shop-subtitle">บริการตัดตัวอักษรโฟม ป้ายโฟมแต่งงาน งานอีเวนต์ ทุกรูปแบบ</p>
                  </div>
                </td>
                <td style="width: 40%; text-align: right; vertical-align: top;">
                  <div class="title-badge" style="display: inline-block;">ใบเสร็จเรียกเก็บเงิน</div>
                </td>
              </tr>
            </table>

            <!-- Customer Details Block -->
            <table class="metadata-table">
              <tr style="background-color: #fafafa;">
                <td style="width: 15%; font-weight: bold;">ชื่อลูกค้า:</td>
                <td style="width: 45%;">${customerName}</td>
                <td style="width: 18%; font-weight: bold; text-align: right;">เลขที่เอกสาร:</td>
                <td style="width: 22%; font-weight: bold; color: #b45309;">${invoiceNo}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">ที่อยู่ / ติดต่อ:</td>
                <td>-</td>
                <td style="font-weight: bold; text-align: right;">วันที่ออกบิล:</td>
                <td>${displayDate}</td>
              </tr>
            </table>

            <!-- Invoice Items Grid -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 8%; text-align: center;">ลำดับ</th>
                  <th style="width: 62%;">รายการสินค้า / รายละเอียดงานสั่งตัด</th>
                  <th style="width: 10%; text-align: center;">จำนวน</th>
                  <th style="width: 10%; text-align: right;">หน่วยละ</th>
                  <th style="width: 10%; text-align: right;">รวมเงิน</th>
                </tr>
              </thead>
              <tbody>
                ${itemRowsHtml}
              </tbody>
            </table>

            <!-- Totals & Payment Grid -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <tr>
                <!-- Payment card side -->
                <td style="width: 55%; vertical-align: top; padding: 0;">
                  ${payQrDirectUrl || payDetailsText ? `
                    <div style="font-size: 0.85rem; font-weight: bold; margin-bottom: 6px; color: #b45309;">ช่องทางการชำระเงิน:</div>
                    <div class="payment-card">
                      ${payQrDirectUrl ? `<img src="${payQrDirectUrl}" class="qr-code-img" alt="QR Code Payment">` : ''}
                      ${payDetailsText ? `
                        <div class="payment-details">
                          <pre style="font-family: inherit; margin: 0; white-space: pre-wrap; font-weight: 500;">${payDetailsText}</pre>
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}
                </td>
                
                <!-- Totals calculation side -->
                <td style="width: 45%; vertical-align: top; padding: 0;">
                  <table class="totals-container" style="float: right; width: 90%;">
                    <tr>
                      <td>รวมค่าสินค้า:</td>
                      <td style="text-align: right; font-weight: 600;">${subtotal.toLocaleString('th-TH')}.00</td>
                    </tr>
                    <tr>
                      <td>🚚 ค่าจัดส่ง:</td>
                      <td style="text-align: right; font-weight: 600;">${shipping.toLocaleString('th-TH')}.00</td>
                    </tr>
                    <tr>
                      <td>🏷️ ส่วนลด:</td>
                      <td style="text-align: right; color: #ef4444; font-weight: 600;">-${discount.toLocaleString('th-TH')}.00</td>
                    </tr>
                    <tr class="grand-total-row">
                      <td>ยอดสุทธิทั้งสิ้น:</td>
                      <td style="text-align: right;">${Math.max(0, total).toLocaleString('th-TH')}.00</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Thank you Message -->
            <div style="text-align: center; margin: 30px 0 10px 0; font-style: italic; color: #4b5563; font-size: 0.88rem;">
              *ขอขอบคุณลูกค้าทุกท่านที่วางใจเลือกใช้บริการตัดป้ายโฟมกับร้านเราครับ*
            </div>

            <!-- Single Dashed Divider Line -->
            <hr style="border: 0; border-top: 1.5px dashed #d1d5db; margin: 25px 0 15px 0; width: 100%;">

            <!-- Signature Section -->
            <table class="signature-section">
              <tr>
                <td class="signature-box" style="width: 40%;">
                  <br><br>
                  (....................................................)<br>
                  <span style="font-size: 0.8rem; color: #4b5563; margin-top: 5px; display: block;">ลูกค้าผู้ชำระเงิน</span>
                </td>
                <td style="width: 20%;"></td>
                <td class="signature-box" style="width: 40%;">
                  <br><br>
                  (....................................................)<br>
                  <span style="font-size: 0.8rem; color: #4b5563; margin-top: 5px; display: block;">แอดมินร้านผู้รับเงิน / ผู้ส่งชิ้นงาน</span>
                </td>
              </tr>
            </table>

          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      
      printWindow.setTimeout(() => {
        printWindow.print();
      }, 500);
    }

    function printSummaryBill() {
      if (activeBillItems.length === 0) {
        alert("กรุณาเลือกรายการสินค้าเข้าบิลอย่างน้อย 1 ชิ้น");
        return;
      }
      
      const customerName = document.getElementById('bill-customer-name').value.trim() || "ลูกค้าสั่งตัดโลโก้โฟม";
      
      const billDateRaw = document.getElementById('bill-date').value;
      let displayDate = billDateRaw;
      if (billDateRaw) {
        const parts = billDateRaw.split('-');
        if (parts.length === 3) {
          const monthsTh = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
          displayDate = `${parseInt(parts[2])} ${monthsTh[parseInt(parts[1]) - 1]} ${parseInt(parts[0]) + 543}`;
        }
      }
      
      const invoiceNo = "INV-" + new Date().toISOString().slice(2,10).replace(/-/g,"") + "-" + Math.floor(100 + Math.random() * 900);
      
      let subtotal = 0;
      const items = activeBillItems.map(item => {
        let desc = "";
        if (item.brideName === '[งานบวช]') {
          desc = `งานตัดป้ายโฟมงานบวช: นาค ${item.groomName} (ชิ้นที่ ${item.pieceIndex})`;
        } else if (item.brideName && item.groomName) {
          desc = `งานตัดป้ายโฟมงานแต่ง: ${item.groomName} & ${item.brideName} (ชิ้นที่ ${item.pieceIndex})`;
        } else {
          desc = `งานตัดป้ายโลโก้โฟมสั่งทำพิเศษ (#${item.id}) (ชิ้นที่ ${item.pieceIndex})`;
        }
        
        const notesVal = item.notes || '';
        const materialMatch = notesVal.match(/\[วัสดุ:\\s*([^\\]]+)\]/);
        const material = materialMatch ? materialMatch[1] : 'รองโฟม'; 
        
        const specDetails = `ขนาด: ${item.pieceSize || '-'} (${material})<br>สีชิ้นงาน: ${item.pieceColor || '-'}`;
        const price = item.billPrice;
        subtotal += price;
        
        return {
          desc: desc,
          specs: specDetails,
          price: price,
          finishedImage: getFinishedImageForPiece(item)
        };
      });
      
      const shipping = parseFloat(document.getElementById('bill-shipping').value) || 0;
      const discount = parseFloat(document.getElementById('bill-discount').value) || 0;
      const total = subtotal + shipping - discount;
      
      const payBank = document.getElementById('payment-bank').value.trim();
      const payAccNum = document.getElementById('payment-account-number').value.trim();
      const payAccName = document.getElementById('payment-account-name').value.trim();
      const payQrUrl = document.getElementById('payment-qr-url').value.trim();
      
      renderAndPrintInvoice(invoiceNo, customerName, displayDate, items, shipping, discount, total, payBank, payAccNum, payAccName, payQrUrl);
      
      const itemIdsWithImages = activeBillItems
        .filter(item => getFinishedImageForPiece(item))
        .map(item => item.billItemId);

      if (itemIdsWithImages.length > 0) {
        setTimeout(() => {
          if (confirm("พิมพ์ใบเสร็จ/ใบวางบิลเรียบร้อยแล้วหรือไม่?\nต้องการลบรูปภาพผลงานชิ้นงานเสร็จในบิลนี้ออกจากระบบคลาวด์ทันที เพื่อประหยัดพื้นที่เก็บข้อมูล (ไม่กินเนื้อที่กิ๊กกะไบต์) หรือไม่?")) {
            clearFinishedImagesFromServer(itemIdsWithImages);
          }
        }, 1000);
      }
    }

    window.printSummaryBill = printSummaryBill;

    // Billing Subtabs and Invoicing History
    function switchBillingSubTab(subTab) {
      const createTab = document.getElementById('billing-subtab-create');
      const historyTab = document.getElementById('billing-subtab-history');
      const btnCreate = document.getElementById('btn-billing-subtab-create');
      const btnHistory = document.getElementById('btn-billing-subtab-history');
      
      if (subTab === 'create') {
        createTab.style.display = 'flex';
        historyTab.style.display = 'none';
        btnCreate.className = 'btn btn-gold';
        btnHistory.className = 'btn btn-outline';
      } else {
        createTab.style.display = 'none';
        historyTab.style.display = 'block';
        btnCreate.className = 'btn btn-outline';
        btnHistory.className = 'btn btn-gold';
        fetchBillsHistory();
      }
    }
    
    window.switchBillingSubTab = switchBillingSubTab;

    async function saveActiveBillToSheet() {
      if (activeBillItems.length === 0) {
        alert("กรุณาเลือกรายการสินค้าเข้าบิลอย่างน้อย 1 ชิ้น");
        return;
      }
      
      const customerName = document.getElementById('bill-customer-name').value.trim();
      if (!customerName) {
        alert("กรุณากรอกชื่อลูกค้าบนหัวบิลก่อนบันทึก");
        return;
      }
      
      const billDateRaw = document.getElementById('bill-date').value;
      let displayDate = billDateRaw || new Date().toISOString().split('T')[0];
      
      let formattedDisplayDate = displayDate;
      const parts = displayDate.split('-');
      if (parts.length === 3) {
        const monthsTh = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        formattedDisplayDate = `${parseInt(parts[2])} ${monthsTh[parseInt(parts[1]) - 1]} ${parseInt(parts[0]) + 543}`;
      }
      
      const invoiceNo = editingBillId || ("INV-" + new Date().toISOString().slice(2,10).replace(/-/g,"") + "-" + Math.floor(100 + Math.random() * 900));
      
      let subtotal = 0;
      const items = activeBillItems.map(item => {
        let desc = "";
        if (item.brideName === '[งานบวช]') {
          desc = `งานตัดป้ายโฟมงานบวช: นาค ${item.groomName} (ชิ้นที่ ${item.pieceIndex})`;
        } else if (item.brideName && item.groomName) {
          desc = `งานตัดป้ายโฟมงานแต่ง: ${item.groomName} & ${item.brideName} (ชิ้นที่ ${item.pieceIndex})`;
        } else {
          desc = `งานตัดป้ายโลโก้โฟมสั่งทำพิเศษ (#${item.id}) (ชิ้นที่ ${item.pieceIndex})`;
        }
        
        const notesVal = item.notes || '';
        const materialMatch = notesVal.match(/\[วัสดุ:\\s*([^\\]]+)\]/);
        const material = materialMatch ? materialMatch[1] : 'รองโฟม';
        
        const specDetails = `ขนาด: ${item.pieceSize || '-'} (${material})<br>สีชิ้นงาน: ${item.pieceColor || '-'}`;
        const price = item.billPrice;
        subtotal += price;
        
        return {
          id: item.id,
          billItemId: item.billItemId,
          desc: desc,
          specs: specDetails,
          price: price,
          finishedImage: getFinishedImageForPiece(item)
        };
      });
      
      const shipping = parseFloat(document.getElementById('bill-shipping').value) || 0;
      const discount = parseFloat(document.getElementById('bill-discount').value) || 0;
      const total = subtotal + shipping - discount;
      
      const payBank = document.getElementById('payment-bank').value.trim();
      const payAccNum = document.getElementById('payment-account-number').value.trim();
      const payAccName = document.getElementById('payment-account-name').value.trim();
      const payQrUrl = document.getElementById('payment-qr-url').value.trim();
      
      const payload = {
        action: 'saveBill',
        billId: invoiceNo,
        customerName: customerName,
        items: items,
        shipping: shipping,
        discount: discount,
        total: total,
        paymentBank: payBank,
        paymentAccountNumber: payAccNum,
        paymentAccountName: payAccName,
        paymentQrUrl: payQrUrl
      };
      
      try {
        const btn = document.getElementById('btn-save-bill') || document.querySelector('button[onclick="saveActiveBillToSheet()"]');
        const origText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "⏳ กำลังบันทึก...";
        
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify(payload),
          redirect: 'follow'
        });
        
        btn.disabled = false;
        btn.innerText = origText;
        
        if (response.ok) {
          const res = await response.json();
          if (res.success) {
            alert(editingBillId ? `บันทึกการแก้ไขบิลเลขที่ ${invoiceNo} สำเร็จ!` : `บันทึกบิลเลขที่ ${invoiceNo} ลง Google Sheets สำเร็จ!`);
            clearActiveBill();
            if (window.cancelEditBill) window.cancelEditBill();
            switchBillingSubTab('history');
          } else {
            alert("บันทึกล้มเหลว: " + res.error);
          }
        } else {
          alert("เชื่อมต่อเซิร์ฟเวอร์ผิดพลาด");
        }
      } catch(err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการบันทึกบิล");
      }
    }
    
    window.saveActiveBillToSheet = saveActiveBillToSheet;

    let allBills = [];
    
    async function fetchBillsHistory() {
      const tbody = document.getElementById('billing-history-list');
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">⏳ กำลังโหลดประวัติการออกบิล...</td></tr>';
      
      if (!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_SHEET_WEB_APP_URL")) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 3rem;">⚠️ กรุณาตั้งค่า Google Sheets URL ก่อน</td></tr>';
        return;
      }
      
      try {
        const response = await fetch(GOOGLE_SHEET_URL + '?action=getBills', { redirect: 'follow' });
        if (response.ok) {
          allBills = await response.json();
          renderBillsHistoryTable();
        } else {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 3rem;">❌ ไม่สามารถดึงประวัติบิลได้</td></tr>';
        }
      } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 3rem;">❌ เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูล</td></tr>';
      }
    }
    
    window.fetchBillsHistory = fetchBillsHistory;
    
    function renderBillsHistoryTable() {
      const tbody = document.getElementById('billing-history-list');
      tbody.innerHTML = '';
      
      if (allBills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">ไม่มีประวัติการออกบิลในระบบ</td></tr>';
        return;
      }
      
      const sortedBills = [...allBills].reverse();
      
      sortedBills.forEach(bill => {
        const tr = document.createElement('tr');
        
        let displayDate = bill.createdDate || '-';
        if (displayDate && displayDate !== '-' && displayDate.includes('-')) {
          const parts = displayDate.split(' ');
          const datePart = parts[0];
          const timePart = parts[1] || '';
          const dParts = datePart.split('-');
          if (dParts.length === 3) {
            displayDate = `${dParts[2]}/${dParts[1]}/${parseInt(dParts[0]) + 543}${timePart ? ' ' + timePart : ''}`;
          }
        }
        
        const totalFormatted = (bill.total || 0).toLocaleString('th-TH');
        
        tr.innerHTML = `
          <td style="font-weight: 600;">${bill.billId}</td>
          <td style="font-size: 0.85rem; color: var(--text-muted);">${displayDate}</td>
          <td>${bill.customerName || '-'}</td>
          <td style="text-align: right; font-weight: 600; color: var(--accent-color);">${totalFormatted} บาท</td>
          <td style="text-align: center;">
            <button class="btn btn-gold" onclick="printHistoricalBill('${bill.billId}')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; margin-right: 3px;">🖨️ พิมพ์บิล</button>
            <button class="btn btn-gold" onclick="editHistoricalBill('${bill.billId}')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; margin-right: 3px; background-color: #0ea5e9; border-color: #0ea5e9;">✏️ แก้ไขบิล</button>
            <button class="btn btn-outline" onclick="deleteBillHistory('${bill.billId}')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; border-color: #ef4444; color: #ef4444;">🗑️ ลบ</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    
    async function deleteBillHistory(billId) {
      if (!confirm(`ยืนยันที่จะลบประวัติบิลเลขที่ ${billId} ออกจาก Google Sheets ใช่หรือไม่?`)) return;
      
      try {
        const response = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'deleteBill',
            billId: billId
          }),
          redirect: 'follow'
        });
        
        if (response.ok) {
          const res = await response.json();
          if (res.success) {
            alert(`ลบประวัติบิลเลขที่ ${billId} สำเร็จ!`);
            fetchBillsHistory();
          } else {
            alert("ลบล้มเหลว: " + res.error);
          }
        } else {
          alert("เชื่อมต่อเซิร์ฟเวอร์ผิดพลาด");
        }
      } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการลบประวัติบิล");
      }
    }
    
    window.deleteBillHistory = deleteBillHistory;

    function printHistoricalBill(billId) {
      const bill = allBills.find(b => b.billId === billId);
      if (!bill) {
        alert("ไม่พบข้อมูลบิลที่เลือก");
        return;
      }
      
      const customerName = bill.customerName || "ลูกค้าสั่งตัดโลโก้โฟม";
      let displayDate = bill.createdDate || '-';
      if (displayDate && displayDate !== '-' && displayDate.includes('T')) {
        displayDate = displayDate.split('T')[0];
      }
      if (displayDate && displayDate.includes('-')) {
        const parts = displayDate.split(' ')[0].split('-');
        if (parts.length === 3) {
          const monthsTh = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
          displayDate = `${parseInt(parts[2])} ${monthsTh[parseInt(parts[1]) - 1]} ${parseInt(parts[0]) + 543}`;
        }
      }
      
      const items = Array.isArray(bill.items) ? bill.items : [];
      const shipping = parseFloat(bill.shipping) || 0;
      const discount = parseFloat(bill.discount) || 0;
      const total = parseFloat(bill.total) || 0;
      
      const payBank = bill.paymentBank || '';
      const payAccNum = bill.paymentAccountNumber || '';
      const payAccName = bill.paymentAccountName || '';
      const payQrUrl = bill.paymentQrUrl || '';
      
      renderAndPrintInvoice(bill.billId, customerName, displayDate, items, shipping, discount, total, payBank, payAccNum, payAccName, payQrUrl);
    }
    
    window.printHistoricalBill = printHistoricalBill;

    function cancelEditBill() {
      editingBillId = null;
      const indicator = document.getElementById('editing-bill-indicator');
      if (indicator) indicator.style.display = 'none';
      const cancelBtn = document.getElementById('btn-cancel-edit-bill');
      if (cancelBtn) cancelBtn.style.display = 'none';
      const saveBtn = document.getElementById('btn-save-bill');
      if (saveBtn) {
        saveBtn.innerHTML = '💾 บันทึกบิลย้อนหลัง';
        saveBtn.style.background = '';
      }
      clearActiveBill();
    }
    
    window.cancelEditBill = cancelEditBill;

    function editHistoricalBill(billId) {
      const bill = allBills.find(b => b.billId === billId);
      if (!bill) {
        alert("ไม่พบข้อมูลบิลที่เลือก");
        return;
      }
      
      clearActiveBill();
      
      editingBillId = billId;
      
      // Update UI Indicators
      const textIdEl = document.getElementById('editing-bill-id-text');
      if (textIdEl) textIdEl.innerText = billId;
      const indicator = document.getElementById('editing-bill-indicator');
      if (indicator) indicator.style.display = 'block';
      const cancelBtn = document.getElementById('btn-cancel-edit-bill');
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';
      
      const saveBtn = document.getElementById('btn-save-bill');
      if (saveBtn) {
        saveBtn.innerHTML = '💾 บันทึกการแก้ไขบิล';
        saveBtn.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
      }
      
      // Switch back to create subtab
      switchBillingSubTab('create');
      
      // Populate fields
      const custNameInput = document.getElementById('bill-customer-name');
      if (custNameInput) custNameInput.value = bill.customerName || '';
      
      // Re-populate Date
      let billDate = bill.createdDate || '';
      if (billDate.includes(' ')) {
        billDate = billDate.split(' ')[0]; // yyyy-MM-dd
      }
      const billDateInput = document.getElementById('bill-date');
      if (billDateInput) billDateInput.value = billDate;
      
      const shippingInput = document.getElementById('bill-shipping');
      if (shippingInput) shippingInput.value = bill.shipping || 0;
      const discountInput = document.getElementById('bill-discount');
      if (discountInput) discountInput.value = bill.discount || 0;
      
      const bankInput = document.getElementById('payment-bank');
      if (bankInput) bankInput.value = bill.paymentBank || '';
      const accNumInput = document.getElementById('payment-account-number');
      if (accNumInput) accNumInput.value = bill.paymentAccountNumber || '';
      const accNameInput = document.getElementById('payment-account-name');
      if (accNameInput) accNameInput.value = bill.paymentAccountName || '';
      const qrUrlInput = document.getElementById('payment-qr-url');
      if (qrUrlInput) qrUrlInput.value = bill.paymentQrUrl || '';
      
      // Previews payment image if exists
      const qrPreviewContainer = document.getElementById('payment-qr-preview-container');
      const qrPreview = document.getElementById('payment-qr-preview');
      if (bill.paymentQrUrl && qrPreviewContainer && qrPreview) {
        const directUrl = getDirectImageUrl(bill.paymentQrUrl);
        qrPreview.src = directUrl;
        qrPreviewContainer.style.display = 'block';
      } else if (qrPreviewContainer) {
        qrPreviewContainer.style.display = 'none';
      }
      
      // Re-populate activeBillItems
      const items = Array.isArray(bill.items) ? bill.items : [];
      
      items.forEach(item => {
        const order = allOrders.find(o => o.id === item.id);
        if (order) {
          const pieceIndex = parseInt(item.billItemId.split('_')[1]) || 1;
          const sizeStr = order.size || '';
          const qtyMatch = sizeStr.match(/จำนวน:\s*(\d+)/);
          const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
          const cleanSize = sizeStr.replace(/\s*\(จำนวน:\s*\d+\s*ชิ้น\)/i, "");
          const sizeParts = cleanSize.split(/ชิ้นที่\s*\d+:\s*/).map(s => s.trim().replace(/,$/, "").replace(/,$/, "")).filter(Boolean);
          const colorStr = order.color || '';
          const colorParts = colorStr.split(/ชิ้นที่\s*\d+:\s*/).map(c => c.trim().replace(/,$/, "").replace(/,$/, "")).filter(Boolean);
          
          const pieceSize = sizeParts[pieceIndex - 1] || sizeParts[0] || cleanSize || '-';
          const pieceColor = colorParts[pieceIndex - 1] || colorParts[0] || colorStr || '-';
          
          activeBillItems.push({
            ...order,
            billItemId: item.billItemId,
            pieceIndex: pieceIndex,
            pieceSize: pieceSize,
            pieceColor: pieceColor,
            billPrice: item.price
          });
        } else {
          // Reconstruct dummy order from description & specs
          let groom = "";
          let bride = "";
          if (item.desc.includes("งานแต่ง:")) {
            const names = item.desc.split("งานแต่ง:")[1].split("(ชิ้นที่")[0].trim();
            const parts = names.split("&");
            groom = parts[0] ? parts[0].trim() : "";
            bride = parts[1] ? parts[1].trim() : "";
          } else if (item.desc.includes("งานบวช:")) {
            groom = item.desc.split("นาค")[1].split("(ชิ้นที่")[0].trim();
            bride = "[งานบวช]";
          }
          
          const specsHtml = item.specs || '';
          const sizeMatch = specsHtml.match(/ขนาด:\s*([^<]+)/);
          const colorMatch = specsHtml.match(/สีชิ้นงาน:\s*(.+)$/);
          const pieceSize = sizeMatch ? sizeMatch[1].split(' (')[0].trim() : '-';
          const pieceColor = colorMatch ? colorMatch[1].trim() : '-';
          
          const materialMatch = specsHtml.match(/\(([^)]+)\)/);
          const material = materialMatch ? materialMatch[1] : 'รองโฟม';
          
          activeBillItems.push({
            id: item.id,
            billItemId: item.billItemId,
            groomName: groom,
            brideName: bride,
            pieceIndex: parseInt(item.billItemId.split('_')[1]) || 1,
            pieceSize: pieceSize,
            pieceColor: pieceColor,
            notes: `[วัสดุ: ${material}]`,
            finishedImage: item.finishedImage || '',
            billPrice: item.price
          });
        }
      });
      
      updateActiveBillTable();
      populateBillingOrdersTable(); // Refresh Left column buttons
    }
    
    window.editHistoricalBill = editHistoricalBill;

    // Init
    window.addEventListener('DOMContentLoaded', () => {
      // Try to load orders if URL is already defined
      if (GOOGLE_SHEET_URL && !GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_SHEET_WEB_APP_URL")) {
        fetchOrders();
      } else {
        loadTab('config');
      }
    });
