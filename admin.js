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
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (isNaN(d.getTime())) return dateString;
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

    // Billing Tab Logic
    let activeBillItems = [];

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

    function addOrderToBill(orderId) {
      const order = allOrders.find(o => o.id === orderId);
      if (!order) return;
      
      if (activeBillItems.some(item => item.id === orderId)) return;
      
      // Add default price field
      activeBillItems.push({
        ...order,
        billPrice: 0
      });
      
      // Auto populate customer name if first item
      const custNameInput = document.getElementById('bill-customer-name');
      if (activeBillItems.length === 1 && !custNameInput.value.trim()) {
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
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">กรุณาเลือกรายการชิ้นงานจากฝั่งซ้ายเพิ่มเข้ามาในบิล</td></tr>';
        document.getElementById('bill-subtotal').innerText = '0';
        document.getElementById('bill-total').innerText = '0';
        return;
      }
      
      activeBillItems.forEach(item => {
        const tr = document.createElement('tr');
        
        let desc = "";
        if (item.brideName === '[งานบวช]') {
          desc = `งานตัดโฟมงานบวช: นาค ${item.groomName}`;
        } else if (item.brideName && item.groomName) {
          desc = `งานตัดโฟมแต่งงาน: ${item.groomName} & ${item.brideName}`;
        } else {
          desc = `งานตัดป้ายโลโก้โฟม:ทั่วไป (#${item.id})`;
        }
        
        // Parse materials backing from notes
        const notesVal = item.notes || '';
        const materialMatch = notesVal.match(/\[วัสดุ:\s*([^\]]+)\]/);
        const material = materialMatch ? materialMatch[1] : 'รองโฟม'; 
        
        const specs = `${item.size || '-'} (${material}) / สี: ${item.color || '-'}`;
        
        tr.innerHTML = `
          <td>
            <div style="font-weight: 600;">${desc}</div>
            <div style="font-size: 0.72rem; color: #a1a1aa; margin-top: 0.15rem;">รหัสชิ้นงาน: #${item.id}</div>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${specs}</td>
          <td style="text-align: right;">
            <input type="number" id="bill-price-${item.id}" class="filter-select bill-item-price" value="${item.billPrice}" min="0" oninput="updateItemPrice(${item.id}, this.value)" style="width: 90px; text-align: right; padding: 0.25rem 0.5rem; font-size: 0.85rem; display: inline-block;">
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      calculateBillingTotal();
    }

    function updateItemPrice(orderId, val) {
      const price = parseFloat(val) || 0;
      const item = activeBillItems.find(i => i.id === orderId);
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

    function printSummaryBill() {
      if (activeBillItems.length === 0) {
        alert("กรุณาเลือกรายการสินค้าเข้าบิลอย่างน้อย 1 ชิ้น");
        return;
      }
      
      const customerName = document.getElementById('bill-customer-name').value.trim() || "ลูกค้าสั่งตัดโลโก้โฟม";
      
      // Formatting date th
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
      
      let itemRowsHtml = "";
      let subtotal = 0;
      
      activeBillItems.forEach((item, index) => {
        let desc = "";
        if (item.brideName === '[งานบวช]') {
          desc = `งานตัดป้ายโฟมงานบวช: นาค ${item.groomName}`;
        } else if (item.brideName && item.groomName) {
          desc = `งานตัดป้ายโฟมงานแต่ง: ${item.groomName} & ${item.brideName}`;
        } else {
          desc = `งานตัดป้ายโลโก้โฟมสั่งทำพิเศษ (#${item.id})`;
        }
        
        const notesVal = item.notes || '';
        const materialMatch = notesVal.match(/\[วัสดุ:\s*([^\]]+)\]/);
        const material = materialMatch ? materialMatch[1] : 'รองโฟม'; 
        
        const specDetails = `ขนาด: ${item.size || '-'} (${material})<br>สีชิ้นงาน: ${item.color || '-'}`;
        const price = item.billPrice;
        subtotal += price;
        
        itemRowsHtml += `
          <tr>
            <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${index + 1}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">
              <div style="font-weight: bold;">${desc}</div>
              <div style="font-size: 0.8rem; color: #555; margin-top: 4px;">${specDetails}</div>
            </td>
            <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">1</td>
            <td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${price.toLocaleString('th-TH')}.00</td>
            <td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${price.toLocaleString('th-TH')}.00</td>
          </tr>
        `;
      });
      
      const shipping = parseFloat(document.getElementById('bill-shipping').value) || 0;
      const discount = parseFloat(document.getElementById('bill-discount').value) || 0;
      const total = subtotal + shipping - discount;
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(\`
        <html>
        <head>
          <title>ใบสรุปรายการสินค้า #\${invoiceNo}</title>
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
              margin-bottom: 20px;
            }
            .header-table td {
              vertical-align: top;
            }
            .shop-title {
              font-size: 1.6rem;
              font-weight: 800;
              color: #b45309;
              margin: 0 0 5px 0;
            }
            .invoice-title {
              font-size: 1.8rem;
              font-weight: 800;
              text-align: right;
              color: #333;
              margin: 0 0 10px 0;
            }
            .metadata-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              background-color: #f9fafb;
              border-radius: 8px;
              overflow: hidden;
            }
            .metadata-table td {
              padding: 12px 15px;
              border: 1px solid #e5e7eb;
              font-size: 0.95rem;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .items-table th {
              background-color: #f3f4f6;
              border: 1px solid #d1d5db;
              padding: 10px;
              font-weight: 700;
              font-size: 0.95rem;
            }
            .totals-table {
              width: 300px;
              margin-left: auto;
              border-collapse: collapse;
              margin-bottom: 40px;
            }
            .totals-table td {
              padding: 8px 12px;
              border: 1px solid #e5e7eb;
              font-size: 0.95rem;
            }
            .grand-total-row {
              background-color: #fef3c7;
              font-weight: 800;
              font-size: 1.15rem !important;
              color: #b45309;
            }
            .signature-section {
              width: 100%;
              margin-top: 50px;
              border-collapse: collapse;
            }
            .signature-box {
              width: 45%;
              text-align: center;
              border-top: 1px dashed #999;
              padding-top: 10px;
              font-size: 0.9rem;
            }
            @media print {
              body { padding: 0; }
              .invoice-box { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            
            <table class="header-table">
              <tr>
                <td>
                  <div class="shop-title">ร้าน Sale Foam สั่งตัดโลโก้โฟม</div>
                  <div style="font-size: 0.88rem; color: #4b5563;">
                    ผู้ผลิตและจำหน่ายป้ายโฟมงานแต่งงาน งานบวช และงานอีเวนต์ต่างๆ<br>
                    📞 ติดต่อโทร: 085-530-4890<br>
                    💬 Line ID: napatch99
                  </div>
                </td>
                <td style="text-align: right;">
                  <div class="invoice-title">ใบเสร็จ / ใบวางบิล</div>
                  <div style="font-size: 0.88rem; color: #4b5563;">
                    เลขที่บิล: <strong>\${invoiceNo}</strong><br>
                    วันที่ออกบิล: \${displayDate}
                  </div>
                </td>
              </tr>
            </table>

            <table class="metadata-table">
              <tr>
                <td style="width: 50%;">
                  <span style="color: #6b7280; font-size: 0.8rem; display: block; margin-bottom: 2px;">ลูกค้าผู้จ่ายเงิน (Bill To)</span>
                  <strong>คุณ \${customerName}</strong>
                </td>
                <td style="width: 50%;">
                  <span style="color: #6b7280; font-size: 0.8rem; display: block; margin-bottom: 2px;">ข้อมูลการจัดส่ง</span>
                  จัดส่งทางไปรษณีย์ / ขนส่งด่วนพิเศษ (ตามที่อยู่ที่แจ้งไว้)
                </td>
              </tr>
            </table>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 8%; text-align: center;">ลำดับ</th>
                  <th style="width: 52%; text-align: left;">รายละเอียดสินค้า/รายการสั่งตัด</th>
                  <th style="width: 10%; text-align: center;">จำนวน</th>
                  <th style="width: 15%; text-align: right;">ราคาต่อชิ้น</th>
                  <th style="width: 15%; text-align: right;">จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                \${itemRowsHtml}
              </tbody>
            </table>

            <table class="totals-table">
              <tr>
                <td>รวมค่าสินค้า:</td>
                <td style="text-align: right;">\${subtotal.toLocaleString('th-TH')}.00</td>
              </tr>
              <tr>
                <td>🚚 ค่าจัดส่ง:</td>
                <td style="text-align: right;">\${shipping.toLocaleString('th-TH')}.00</td>
              </tr>
              <tr>
                <td>🏷️ ส่วนลด:</td>
                <td style="text-align: right; color: red;">-\${discount.toLocaleString('th-TH')}.00</td>
              </tr>
              <tr class="grand-total-row">
                <td>ยอดสุทธิทั้งสิ้น:</td>
                <td style="text-align: right;">\${Math.max(0, total).toLocaleString('th-TH')}.00</td>
              </tr>
            </table>

            <div style="text-align: center; margin: 40px 0; font-style: italic; color: #4b5563; font-size: 0.9rem;">
              *ขอขอบคุณลูกค้าทุกท่านที่วางใจเลือกใช้บริการตัดป้ายโฟมกับร้านเราครับ*
            </div>

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
      \`);
      printWindow.document.close();
      
      printWindow.setTimeout(() => {
        printWindow.print();
      }, 500);
    }

    window.printSummaryBill = printSummaryBill;

    // Init
    window.addEventListener('DOMContentLoaded', () => {
      // Try to load orders if URL is already defined
      if (GOOGLE_SHEET_URL && !GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_SHEET_WEB_APP_URL")) {
        fetchOrders();
      } else {
        loadTab('config');
      }
    });