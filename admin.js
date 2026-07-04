    // Paste your Google Sheets Web App URL here as a hardcoded fallback
    const DEFAULT_GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzH8TL29xMHAJ3LuwID751ifsOeS1wb7Bi28AtmHV1osLvxa9-SYFov5rGXET-zk_cvMw/exec";

    // Read URL from localStorage or use default fallback
    let GOOGLE_SHEET_URL = localStorage.getItem('google_sheet_url') || DEFAULT_GOOGLE_SHEET_URL;

    let allOrders = [];
    let allColors = [];
    let selectedOrder = null;

    // View Navigation Tabs
    function loadTab(tabName) {
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('btn-tab-' + tabName).classList.add('active');

      document.getElementById('tab-orders').style.display = 'none';
      document.getElementById('tab-colors').style.display = 'none';
      document.getElementById('tab-config').style.display = 'none';

      if (tabName === 'orders') {
        document.getElementById('tab-orders').style.display = 'block';
        fetchOrders();
      } else if (tabName === 'colors') {
        document.getElementById('tab-colors').style.display = 'block';
        fetchColors();
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
        const weddingNames = (order.groomName || order.brideName) 
          ? `🤵 ${order.groomName || '-'} & 👰 ${order.brideName || '-'}` 
          : '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">ไม่มีระบุ (โลโก้ทั่วไป)</span>';

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

    function formatThaiDate(dateString) {
      if (!dateString) return '-';
      try {
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
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
      document.getElementById('sheet-created-date').innerText = selectedOrder.createdDate || '-';
      document.getElementById('sheet-required-date').innerText = formatThaiDate(selectedOrder.requiredDate);
      document.getElementById('sheet-customer-name').innerText = selectedOrder.customerName;
      document.getElementById('sheet-groom-name').innerText = selectedOrder.groomName || '-';
      document.getElementById('sheet-bride-name').innerText = selectedOrder.brideName || '-';
      document.getElementById('sheet-size').innerText = selectedOrder.size;
      document.getElementById('sheet-color').innerText = selectedOrder.color;
      document.getElementById('sheet-notes').innerText = selectedOrder.notes || '-';

      // Load Images
      const imgContainer = document.getElementById('sheet-images-container');
      imgContainer.innerHTML = '';
      
      if (selectedOrder.images && selectedOrder.images.length > 0) {
        selectedOrder.images.forEach(imgUrl => {
          const wrapper = document.createElement('div');
          wrapper.className = 'job-sheet-image-wrapper';
          wrapper.innerHTML = `<img src="${imgUrl}" alt="Foam logo sample image" onclick="window.open('${imgUrl}')" style="cursor: pointer;">`;
          imgContainer.appendChild(wrapper);
        });
      } else {
        imgContainer.innerHTML = '<div style="color: #666; font-style: italic;">ไม่มีการอัปโหลดรูปภาพ</div>';
      }

      document.getElementById('order-modal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('order-modal').classList.remove('active');
      selectedOrder = null;
    }

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

    // Config Fetch & Save
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

      const config = {
        action: 'saveConfig',
        lineNotifyEnabled: document.getElementById('line-notify-enabled').checked,
        lineChannelAccessToken: document.getElementById('line-token').value,
        lineRecipientId: document.getElementById('line-recipient').value
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
            alert('บันทึกการตั้งค่าระบบและซิงค์กับ Google Sheets เรียบร้อยแล้ว!');
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

    // Init
    window.addEventListener('DOMContentLoaded', () => {
      // Try to load orders if URL is already defined
      if (GOOGLE_SHEET_URL && !GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_SHEET_WEB_APP_URL")) {
        fetchOrders();
      } else {
        loadTab('config');
      }
    });