/**
 * Google Apps Script for Custom Logo Foam Ordering System
 * 
 * Paste this script into your Google Sheet's Apps Script editor (Extensions > Apps Script).
 * Deploy it as a Web App (Deploy > New Deployment > Web App):
 *   - Execute as: Me (ฉัน)
 *   - Who has access: Anyone (ทุกคน)
 * Copy the generated Web App URL and paste it into the constant GOOGLE_SHEET_URL in index.html and admin.html.
 */

function doGet(e) {
  e = e || { parameter: {} };
  var action = e.parameter.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // CORS & JSON Helper
  function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    if (action === 'getColors') {
      var colorSheet = sheet.getSheetByName('Colors') || createColorsSheet(sheet);
      var data = colorSheet.getDataRange().getValues();
      var colors = [];
      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) {
          colors.push(data[i][0]);
        }
      }
      return jsonResponse(colors);
    }
    
    if (action === 'getOrders') {
      var orderSheet = sheet.getSheetByName('Orders') || createOrdersSheet(sheet);
      var data = orderSheet.getDataRange().getValues();
      var headers = data[0];
      var orders = [];
      var tz = sheet.getSpreadsheetTimeZone();
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var order = {};
        for (var j = 0; j < headers.length; j++) {
          var key = headers[j];
          var val = row[j];
          if (key === 'id') val = Number(val);
          if (key === 'images') {
            val = val ? val.split(',').map(function(item) { return item.trim(); }) : [];
          }
          if (val && Object.prototype.toString.call(val) === '[object Date]') {
            if (key === 'createdDate') {
              val = Utilities.formatDate(val, tz, "yyyy-MM-dd HH:mm:ss");
            } else {
              val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
            }
          }
          order[key] = val;
        }
        orders.push(order);
      }
      return jsonResponse(orders);
    }
    
    if (action === 'getCustomerOrders') {
      var customerName = e.parameter.customerName;
      if (!customerName) {
        return jsonResponse([]);
      }
      customerName = customerName.trim().toLowerCase();
      var orderSheet = sheet.getSheetByName('Orders') || createOrdersSheet(sheet);
      var data = orderSheet.getDataRange().getValues();
      if (data.length <= 1) return jsonResponse([]);
      
      var headers = data[0];
      var customerNameIdx = headers.indexOf('customerName');
      if (customerNameIdx === -1) return jsonResponse([]);
      
      var orders = [];
      var tz = sheet.getSpreadsheetTimeZone();
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var rowCustName = String(row[customerNameIdx]).trim().toLowerCase();
        if (rowCustName === customerName) {
          var order = {};
          for (var j = 0; j < headers.length; j++) {
            var key = headers[j];
            var val = row[j];
            if (key === 'id') val = Number(val);
            if (key === 'images') {
              val = val ? val.split(',').map(function(item) { return item.trim(); }) : [];
            }
            if (val && Object.prototype.toString.call(val) === '[object Date]') {
              if (key === 'createdDate') {
                val = Utilities.formatDate(val, tz, "yyyy-MM-dd HH:mm:ss");
              } else {
                val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
              }
            }
            order[key] = val;
          }
          orders.push(order);
        }
      }
      return jsonResponse(orders);
    }

    if (action === 'getConfig') {
      var configSheet = sheet.getSheetByName('Config') || createConfigSheet(sheet);
      var data = configSheet.getDataRange().getValues();
      var config = {
        lineNotifyEnabled: false,
        lineChannelAccessToken: "",
        lineRecipientId: "",
        paymentBank: "",
        paymentAccountNumber: "",
        paymentAccountName: "",
        paymentQrUrl: ""
      };
      
      for (var i = 1; i < data.length; i++) {
        var key = data[i][0];
        var val = data[i][1];
        if (key === 'lineNotifyEnabled') config.lineNotifyEnabled = (val === true || val === 'true');
        if (key === 'lineChannelAccessToken') config.lineChannelAccessToken = val;
        if (key === 'lineRecipientId') config.lineRecipientId = val;
        if (key === 'paymentBank') config.paymentBank = val;
        if (key === 'paymentAccountNumber') config.paymentAccountNumber = val;
        if (key === 'paymentAccountName') config.paymentAccountName = val;
        if (key === 'paymentQrUrl') config.paymentQrUrl = val;
      }
      return jsonResponse(config);
    }
    if (action === 'getBills') {
      var billsSheet = sheet.getSheetByName('Bills') || createBillsSheet(sheet);
      var data = billsSheet.getDataRange().getValues();
      if (data.length <= 1) return jsonResponse([]);
      
      var headers = data[0];
      var bills = [];
      var tz = sheet.getSpreadsheetTimeZone();
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var bill = {};
        for (var j = 0; j < headers.length; j++) {
          var key = headers[j];
          var val = row[j];
          if (key === 'items') {
            try {
              val = JSON.parse(val);
            } catch(err) {
              val = [];
            }
          }
          if (val && Object.prototype.toString.call(val) === '[object Date]') {
            val = Utilities.formatDate(val, tz, "yyyy-MM-dd HH:mm:ss");
          }
          bill[key] = val;
        }
        bills.push(bill);
      }
      return jsonResponse(bills);
    }
    
    return jsonResponse({ success: false, error: 'Invalid action parameter' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  e = e || { postData: { contents: "{}" } };
  function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    var params = JSON.parse(e.postData.contents || "{}");
    
    // Check if this is a LINE Webhook
    if (params.events && Array.isArray(params.events)) {
      handleLineWebhook(params.events);
      return jsonResponse({ success: true, message: "LINE webhook processed successfully" });
    }
    
    var action = params.action;
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'addOrder') {
      var orderSheet = sheet.getSheetByName('Orders') || createOrdersSheet(sheet);
      var data = orderSheet.getDataRange().getValues();
      var headers = data[0];
      
      // Calculate next ID
      var nextId = 1;
      if (data.length > 1) {
        var maxId = 0;
        for (var i = 1; i < data.length; i++) {
          var id = Number(data[i][0]);
          if (id > maxId) maxId = id;
        }
        nextId = maxId + 1;
      }
      
      // Decode and save images to Google Drive
      var imageUrls = [];
      if (params.images && params.images.length > 0) {
        var folderName = "Logo Foam Uploads";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder;
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          folder = DriveApp.createFolder(folderName);
        }
        
        params.images.forEach(function(img) {
          if (img.data && img.data.indexOf('base64,') > -1) {
            var parts = img.data.split('base64,');
            var contentType = parts[0].split(':')[1].split(';')[0];
            var base64Data = parts[1];
            
            var decoded = Utilities.base64Decode(base64Data);
            var blob = Utilities.newBlob(decoded, contentType, "order_" + nextId + "_" + img.filename);
            var file = folder.createFile(blob);
            
            // Set public sharing so the admin dashboard can load it
            file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
            imageUrls.push(file.getUrl());
          }
        });
      }
      
      // Create new row
      var rowData = [];
      for (var j = 0; j < headers.length; j++) {
        var key = headers[j];
        if (key === 'id') {
          rowData.push(nextId);
        } else if (key === 'images') {
          rowData.push(imageUrls.join(','));
        } else if (key === 'createdDate') {
          rowData.push(Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"));
        } else if (key === 'status') {
          rowData.push("รอดำเนินการ");
        } else {
          rowData.push(params[key] || '');
        }
      }
      
      orderSheet.appendRow(rowData);
      
      // Trigger LINE Push notification safely
      try {
        triggerLineNotification(sheet, nextId, params, imageUrls);
      } catch (lineErr) {
        Logger.log("Error in triggerLineNotification inside doPost: " + lineErr.toString());
      }
      
      return jsonResponse({ success: true, id: nextId });
    }
    
    if (action === 'editOrder') {
      var orderSheet = sheet.getSheetByName('Orders') || createOrdersSheet(sheet);
      var data = orderSheet.getDataRange().getValues();
      var headers = data[0];
      var targetId = params.id;
      
      var targetRowIdx = -1;
      for (var i = 1; i < data.length; i++) {
        if (Number(data[i][0]) === Number(targetId)) {
          targetRowIdx = i + 1;
          break;
        }
      }
      
      if (targetRowIdx === -1) {
        return jsonResponse({ success: false, error: 'Order not found' });
      }
      
      var imageUrls = [];
      if (params.images && params.images.length > 0) {
        var folderName = "Logo Foam Uploads";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        params.images.forEach(function(img) {
          if (img.isExisting && img.url) {
            imageUrls.push(img.url);
          } else if (img.data && img.data.indexOf('base64,') > -1) {
            var parts = img.data.split('base64,');
            var contentType = parts[0].split(':')[1].split(';')[0];
            var base64Data = parts[1];
            
            var decoded = Utilities.base64Decode(base64Data);
            var blob = Utilities.newBlob(decoded, contentType, "order_" + targetId + "_" + img.filename);
            var file = folder.createFile(blob);
            
            file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
            imageUrls.push(file.getUrl());
          }
        });
      }
      
      var customerNameIdx = headers.indexOf('customerName');
      var groomNameIdx = headers.indexOf('groomName');
      var brideNameIdx = headers.indexOf('brideName');
      var requiredDateIdx = headers.indexOf('requiredDate');
      var sizeIdx = headers.indexOf('size');
      var colorIdx = headers.indexOf('color');
      var notesIdx = headers.indexOf('notes');
      var imagesIdx = headers.indexOf('images');
      
      if (customerNameIdx > -1) orderSheet.getRange(targetRowIdx, customerNameIdx + 1).setValue(params.customerName || '');
      if (groomNameIdx > -1) orderSheet.getRange(targetRowIdx, groomNameIdx + 1).setValue(params.groomName || '');
      if (brideNameIdx > -1) orderSheet.getRange(targetRowIdx, brideNameIdx + 1).setValue(params.brideName || '');
      if (requiredDateIdx > -1) orderSheet.getRange(targetRowIdx, requiredDateIdx + 1).setValue(params.requiredDate || '');
      if (sizeIdx > -1) orderSheet.getRange(targetRowIdx, sizeIdx + 1).setValue(params.size || '');
      if (colorIdx > -1) orderSheet.getRange(targetRowIdx, colorIdx + 1).setValue(params.color || '');
      if (notesIdx > -1) orderSheet.getRange(targetRowIdx, notesIdx + 1).setValue(params.notes || '');
      if (imagesIdx > -1) orderSheet.getRange(targetRowIdx, imagesIdx + 1).setValue(imageUrls.join(','));
      
      try {
        triggerLineUpdateNotification(sheet, targetId, params, imageUrls);
      } catch (lineErr) {
        Logger.log("Error in triggerLineUpdateNotification: " + lineErr.toString());
      }
      
      return jsonResponse({ success: true });
    }
    
    if (action === 'updateStatus') {
      var orderSheet = sheet.getSheetByName('Orders') || createOrdersSheet(sheet);
      var data = orderSheet.getDataRange().getValues();
      var targetId = params.id;
      var newStatus = params.status;
      var statusIndex = data[0].indexOf('status');
      
      if (statusIndex === -1) {
        return jsonResponse({ success: false, error: 'Status column not found' });
      }
      
      for (var i = 1; i < data.length; i++) {
        if (Number(data[i][0]) === Number(targetId)) {
          orderSheet.getRange(i + 1, statusIndex + 1).setValue(newStatus);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: 'Order not found' });
    }
    
    if (action === 'updateFinishedImage') {
      var orderSheet = sheet.getSheetByName('Orders') || createOrdersSheet(sheet);
      var data = orderSheet.getDataRange().getValues();
      var headers = data[0];
      
      var finishedImageIdx = headers.indexOf('finishedImage');
      if (finishedImageIdx === -1) {
        orderSheet.getRange(1, headers.length + 1).setValue('finishedImage');
        headers.push('finishedImage');
        finishedImageIdx = headers.length - 1;
        data = orderSheet.getDataRange().getValues();
      }
      
      var targetId = params.id;
      var pieceIdx = params.pieceIndex ? Number(params.pieceIndex) : 1;
      var fileUrl = "";
      
      if (params.image && params.image.data && params.image.data.indexOf('base64,') > -1) {
        var folderName = "Logo Foam Uploads";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        var parts = params.image.data.split('base64,');
        var contentType = parts[0].split(':')[1].split(';')[0];
        var base64Data = parts[1];
        
        var decoded = Utilities.base64Decode(base64Data);
        var blob = Utilities.newBlob(decoded, contentType, "finished_" + targetId + "_" + pieceIdx);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();
      }
      
      for (var i = 1; i < data.length; i++) {
        if (Number(data[i][0]) === Number(targetId)) {
          var currentVal = String(data[i][finishedImageIdx] || '');
          var urls = currentVal ? currentVal.split(',') : [];
          while (urls.length < pieceIdx) {
            urls.push('');
          }
          urls[pieceIdx - 1] = fileUrl;
          var combinedUrls = urls.join(',');
          orderSheet.getRange(i + 1, finishedImageIdx + 1).setValue(combinedUrls);
          return jsonResponse({ success: true, finishedImage: combinedUrls });
        }
      }
      return jsonResponse({ success: false, error: 'Order not found' });
    }

    if (action === 'deleteFinishedImages') {
      var orderSheet = sheet.getSheetByName('Orders') || createOrdersSheet(sheet);
      var data = orderSheet.getDataRange().getValues();
      var headers = data[0];
      var finishedImageIdx = headers.indexOf('finishedImage');
      
      if (finishedImageIdx === -1) {
        return jsonResponse({ success: true });
      }
      
      var targetIds = params.ids;
      if (!targetIds || !targetIds.length) {
        return jsonResponse({ success: false, error: 'No IDs provided' });
      }
      
      var count = 0;
      var lastUpdatedUrls = "";
      for (var k = 0; k < targetIds.length; k++) {
        var targetStr = String(targetIds[k]);
        var parts = targetStr.split('_');
        var orderId = Number(parts[0]);
        var pieceIdx = parts[1] ? Number(parts[1]) : 1;
        
        for (var i = 1; i < data.length; i++) {
          var rowId = Number(data[i][0]);
          if (rowId === orderId) {
            var currentVal = String(orderSheet.getRange(i + 1, finishedImageIdx + 1).getValue() || '');
            var urls = currentVal ? currentVal.split(',') : [];
            
            if (urls[pieceIdx - 1]) {
              var fileUrl = urls[pieceIdx - 1];
              try {
                var match = fileUrl.match(/\/file\/d\/([^/]+)/) || fileUrl.match(/id=([^&]+)/);
                if (match && match[1]) {
                  DriveApp.getFileById(match[1]).setTrashed(true);
                }
              } catch (err) {
                console.error('Error deleting file: ' + fileUrl, err);
              }
              urls[pieceIdx - 1] = '';
              count++;
            }
            
            while (urls.length > 0 && urls[urls.length - 1] === '') {
              urls.pop();
            }
            
            lastUpdatedUrls = urls.join(',');
            orderSheet.getRange(i + 1, finishedImageIdx + 1).setValue(lastUpdatedUrls);
            data[i][finishedImageIdx] = lastUpdatedUrls;
          }
        }
      }
      return jsonResponse({ success: true, clearedCount: count, finishedImage: lastUpdatedUrls });
    }

    if (action === 'deleteOrder') {
      var orderSheet = sheet.getSheetByName('Orders') || createOrdersSheet(sheet);
      var data = orderSheet.getDataRange().getValues();
      var targetId = params.id;
      
      for (var i = 1; i < data.length; i++) {
        if (Number(data[i][0]) === Number(targetId)) {
          orderSheet.deleteRow(i + 1);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: 'Order not found' });
    }
    
    if (action === 'saveBill') {
      var billsSheet = sheet.getSheetByName('Bills') || createBillsSheet(sheet);
      var data = billsSheet.getDataRange().getValues();
      var targetBillId = params.billId;
      
      var targetRowIdx = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetBillId)) {
          targetRowIdx = i + 1;
          break;
        }
      }
      
      var rowValues = [
        params.billId,
        targetRowIdx > -1 ? data[targetRowIdx - 1][1] : Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
        params.customerName,
        JSON.stringify(params.items),
        params.shipping || 0,
        params.discount || 0,
        params.total || 0,
        params.paymentBank || '',
        params.paymentAccountNumber || '',
        params.paymentAccountName || '',
        params.paymentQrUrl || ''
      ];
      
      if (targetRowIdx > -1) {
        billsSheet.getRange(targetRowIdx, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        billsSheet.appendRow(rowValues);
      }
      return jsonResponse({ success: true });
    }
    
    if (action === 'deleteBill') {
      var billsSheet = sheet.getSheetByName('Bills') || createBillsSheet(sheet);
      var data = billsSheet.getDataRange().getValues();
      var targetBillId = params.billId;
      
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetBillId)) {
          billsSheet.deleteRow(i + 1);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: 'Bill not found' });
    }
    
    if (action === 'addColor') {
      var colorSheet = sheet.getSheetByName('Colors') || createColorsSheet(sheet);
      var colorName = params.color;
      
      var data = colorSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === colorName) {
          return jsonResponse({ success: true, message: 'Color already exists' });
        }
      }
      
      colorSheet.appendRow([colorName]);
      return jsonResponse({ success: true });
    }
    
    if (action === 'deleteColor') {
      var colorSheet = sheet.getSheetByName('Colors') || createColorsSheet(sheet);
      var data = colorSheet.getDataRange().getValues();
      var targetColor = params.color;
      
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === targetColor) {
          colorSheet.deleteRow(i + 1);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: 'Color not found' });
    }

    if (action === 'saveConfig') {
      var configSheet = sheet.getSheetByName('Config') || createConfigSheet(sheet);
      
      var paymentQrUrl = params.paymentQrUrl || '';
      
      // Decode and save QR code image if uploaded
      if (params.qrImage && params.qrImage.data && params.qrImage.data.indexOf('base64,') > -1) {
        var folderName = "Logo Foam Uploads";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        var parts = params.qrImage.data.split('base64,');
        var contentType = parts[0].split(':')[1].split(';')[0];
        var base64Data = parts[1];
        
        var decoded = Utilities.base64Decode(base64Data);
        var blob = Utilities.newBlob(decoded, contentType, "shop_payment_qr_code");
        var file = folder.createFile(blob);
        
        // Public sharing
        file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
        paymentQrUrl = file.getUrl();
      }
      
      configSheet.clearContents();
      configSheet.appendRow(['Key', 'Value']);
      configSheet.appendRow(['lineNotifyEnabled', params.lineNotifyEnabled]);
      configSheet.appendRow(['lineChannelAccessToken', params.lineChannelAccessToken]);
      configSheet.appendRow(['lineRecipientId', params.lineRecipientId]);
      configSheet.appendRow(['paymentBank', params.paymentBank || '']);
      configSheet.appendRow(['paymentAccountNumber', "'" + (params.paymentAccountNumber || '')]);
      configSheet.appendRow(['paymentAccountName', params.paymentAccountName || '']);
      configSheet.appendRow(['paymentQrUrl', paymentQrUrl]);
      
      // If it is a test notify request
      if (params.isTest) {
        var testMessage = "🔔 ทดสอบแจ้งเตือนระบบสั่งตัดโลโก้โฟม\nข้อความนี้ถูกส่งจากการตั้งค่าบน Google Sheets";
        sendLinePushMessage(params.lineChannelAccessToken, params.lineRecipientId, [{ type: "text", text: testMessage }]);
      }
      
      return jsonResponse({ success: true, paymentQrUrl: paymentQrUrl });
    }
    
    return jsonResponse({ success: false, error: 'Invalid action parameter in body' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function triggerLineNotification(sheet, nextId, params, imageUrls) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet();
  params = params || {};
  imageUrls = imageUrls || [];
  nextId = nextId || "TEST";
  
  var configSheet = sheet.getSheetByName('Config') || createConfigSheet(sheet);
  try {
    var configData = configSheet.getDataRange().getValues();
    
    var lineNotifyEnabled = false;
    var lineChannelAccessToken = "";
    var lineRecipientId = "";
    
    for (var i = 1; i < configData.length; i++) {
      var key = String(configData[i][0]).trim();
      var val = configData[i][1];
      if (key.toLowerCase() === 'linenotifyenabled') {
        lineNotifyEnabled = (String(val).toLowerCase() === 'true' || val === true);
      }
      if (key.toLowerCase() === 'linechannelaccesstoken') {
        lineChannelAccessToken = String(val).trim();
      }
      if (key.toLowerCase() === 'linerecipientid') {
        lineRecipientId = String(val).trim();
      }
    }
    
    if (!lineNotifyEnabled) {
      writeErrorToConfig(configSheet, "การแจ้งเตือนถูกปิดใช้งานใน Config (lineNotifyEnabled = false)");
      return;
    }
    
    if (!lineChannelAccessToken) {
      writeErrorToConfig(configSheet, "ข้อมูลไม่ครบถ้วน: ไม่พบค่า LINE Token");
      return;
    }
    
    var groom = params.groomName || "-";
    var bride = params.brideName || "-";
    var notes = params.notes || "-";
    
    var rawDate = params.requiredDate;
    var displayDate = rawDate;
    if (rawDate && rawDate.split('-').length === 3) {
      var dateParts = rawDate.split('-');
      displayDate = dateParts[2] + "/" + dateParts[1] + "/" + (parseInt(dateParts[0]) + 543);
    }
    
    var messageText = "";
    if (bride === '[งานบวช]') {
      messageText = "🔔 มีงานสั่งตัดโลโก้โฟมใหม่! (งานบวช) (รหัส #" + nextId + ")\n" +
                    "👤 ลูกค้า: " + params.customerName + "\n" +
                    "👶 ชื่อนาค: " + groom + "\n" +
                    "📅 วันที่ใช้: " + displayDate + "\n" +
                    "📐 ขนาด: " + params.size + "\n" +
                    "🎨 สี: " + params.color + "\n" +
                    "📝 หมายเหตุ: " + notes;
    } else {
      messageText = "🔔 มีงานสั่งตัดโลโก้โฟมใหม่! (รหัส #" + nextId + ")\n" +
                    "👤 ลูกค้า: " + params.customerName + "\n" +
                    "🤵 เจ้าบ่าว: " + groom + "\n" +
                    "👰 เจ้าสาว: " + bride + "\n" +
                    "📅 วันที่ใช้: " + displayDate + "\n" +
                    "📐 ขนาด: " + params.size + "\n" +
                    "🎨 สี: " + params.color + "\n" +
                    "📝 หมายเหตุ: " + notes;
    }
                      
    var lineMessages = [
      {
        type: "text",
        text: messageText
      }
    ];
    
    if (imageUrls && imageUrls.length > 0) {
      var imgCount = 0;
      imageUrls.forEach(function(url) {
        if (imgCount < 4) {
          var directUrl = getDirectImageUrlAppsScript(url);
          if (directUrl) {
            lineMessages.push({
              type: "image",
              originalContentUrl: directUrl,
              previewImageUrl: directUrl
            });
            imgCount++;
          }
        }
      });
    }
 
    sendLinePushMessage(lineChannelAccessToken, lineRecipientId, lineMessages, configSheet, imageUrls);
  } catch (err) {
    Logger.log("Error in triggerLineNotification: " + err.toString());
    writeErrorToConfig(configSheet, "Script Crash: " + err.toString());
  }
}

function triggerLineUpdateNotification(sheet, targetId, params, imageUrls) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet();
  params = params || {};
  imageUrls = imageUrls || [];
  targetId = targetId || "TEST";
  
  var configSheet = sheet.getSheetByName('Config') || createConfigSheet(sheet);
  try {
    var configData = configSheet.getDataRange().getValues();
    
    var lineNotifyEnabled = false;
    var lineChannelAccessToken = "";
    var lineRecipientId = "";
    
    for (var i = 1; i < configData.length; i++) {
      var key = String(configData[i][0]).trim();
      var val = configData[i][1];
      if (key.toLowerCase() === 'linenotifyenabled') {
        lineNotifyEnabled = (String(val).toLowerCase() === 'true' || val === true);
      }
      if (key.toLowerCase() === 'linechannelaccesstoken') {
        lineChannelAccessToken = String(val).trim();
      }
      if (key.toLowerCase() === 'linerecipientid') {
        lineRecipientId = String(val).trim();
      }
    }
    
    if (!lineNotifyEnabled) {
      return;
    }
    
    if (!lineChannelAccessToken) {
      return;
    }
    
    var groom = params.groomName || "-";
    var bride = params.brideName || "-";
    var notes = params.notes || "-";
    
    var rawDate = params.requiredDate;
    var displayDate = rawDate;
    if (rawDate && rawDate.split('-').length === 3) {
      var dateParts = rawDate.split('-');
      displayDate = dateParts[2] + "/" + dateParts[1] + "/" + (parseInt(dateParts[0]) + 543);
    }
    
    var messageText = "";
    if (bride === '[งานบวช]') {
      messageText = "✏️ มีการแก้ไขรายละเอียดสั่งตัด! (งานบวช) (รหัส #" + targetId + ")\n" +
                    "👤 ลูกค้า: " + params.customerName + "\n" +
                    "👶 ชื่อนาค: " + groom + "\n" +
                    "📅 วันที่ใช้: " + displayDate + "\n" +
                    "📐 ขนาด: " + params.size + "\n" +
                    "🎨 สี: " + params.color + "\n" +
                    "📝 หมายเหตุ: " + notes;
    } else {
      messageText = "✏️ มีการแก้ไขรายละเอียดสั่งตัด! (รหัส #" + targetId + ")\n" +
                    "👤 ลูกค้า: " + params.customerName + "\n" +
                    "🤵 เจ้าบ่าว: " + groom + "\n" +
                    "👰 เจ้าสาว: " + bride + "\n" +
                    "📅 วันที่ใช้: " + displayDate + "\n" +
                    "📐 ขนาด: " + params.size + "\n" +
                    "🎨 สี: " + params.color + "\n" +
                    "📝 หมายเหตุ: " + notes;
    }
                       
    var lineMessages = [
      {
        type: "text",
        text: messageText
      }
    ];
    
    if (imageUrls && imageUrls.length > 0) {
      var imgCount = 0;
      imageUrls.forEach(function(url) {
        if (imgCount < 4) {
          var directUrl = getDirectImageUrlAppsScript(url);
          if (directUrl) {
            lineMessages.push({
              type: "image",
              originalContentUrl: directUrl,
              previewImageUrl: directUrl
            });
            imgCount++;
          }
        }
      });
    }
 
    sendLinePushMessage(lineChannelAccessToken, lineRecipientId, lineMessages, configSheet, imageUrls);
  } catch (err) {
    Logger.log("Error in triggerLineUpdateNotification: " + err.toString());
  }
}

function getDirectImageUrlAppsScript(url) {
  if (!url) return '';
  var match = url.match(/\/file\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
  if (match && match[1]) {
    return "https://lh3.googleusercontent.com/d/" + match[1];
  }
  return url;
}

function writeErrorToConfig(configSheet, errText) {
  try {
    var data = configSheet.getDataRange().getValues();
    var foundRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === 'lasterror') {
        foundRow = i + 1;
        break;
      }
    }
    if (foundRow !== -1) {
      configSheet.getRange(foundRow, 2).setValue(errText);
    } else {
      configSheet.appendRow(['lastError', errText]);
    }
  } catch (e) {
    Logger.log("Failed to write error to sheet: " + e.toString());
  }
}

function sendLinePushMessage(token, toId, messagesArray, configSheet, imageUrls) {
  try {
    // Autodetect LINE Notify (1-token free service) vs LINE Bot (Messaging API)
    // If recipient ID is empty or token is standard 43-character notify token
    var isLineNotify = (!toId || toId.trim() === "" || token.trim().length === 43);
    
    if (isLineNotify) {
      var messageString = "";
      messagesArray.forEach(function(msg) {
        if (msg.type === "text") {
          messageString += msg.text + "\n";
        }
      });
      
      var postPayload = {
        message: messageString.trim()
      };
      
      if (imageUrls && imageUrls.length > 0) {
        var directUrl = getDirectImageUrlAppsScript(imageUrls[0]);
        if (directUrl) {
          postPayload.imageThumbnail = directUrl;
          postPayload.imageFullsize = directUrl;
        }
      }
      
      var options = {
        method: "post",
        headers: {
          "Authorization": "Bearer " + token
        },
        payload: postPayload,
        muteHttpExceptions: true
      };
      
      var res = UrlFetchApp.fetch("https://notify-api.line.me/api/notify", options);
      var resText = res.getContentText();
      var code = res.getResponseCode();
      Logger.log("LINE Notify response: " + resText);
      
      if (code !== 200) {
        writeErrorToConfig(configSheet, "LINE Notify Error code " + code + ": " + resText);
      } else {
        writeErrorToConfig(configSheet, "ไม่มีข้อผิดพลาด (ส่งผ่าน LINE Notify สำเร็จ: " + Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss") + ")");
      }
      return;
    }

    // LINE Bot Messaging API push message
    var payload = {
      to: toId,
      messages: messagesArray
    };
    
    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "Authorization": "Bearer " + token
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
    var resText = res.getContentText();
    var code = res.getResponseCode();
    Logger.log("LINE push response: " + resText);
    
    if (code !== 200) {
      writeErrorToConfig(configSheet, "LINE Bot Error code " + code + ": " + resText);
    } else {
      writeErrorToConfig(configSheet, "ไม่มีข้อผิดพลาด (ส่งผ่าน LINE Bot สำเร็จ: " + Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss") + ")");
    }
  } catch (err) {
    Logger.log("Error in sendLinePushMessage: " + err.toString());
    if (configSheet) {
      writeErrorToConfig(configSheet, "UrlFetchApp Error: " + err.toString());
    }
  }
}

// Initializing helpers
function createColorsSheet(sheet) {
  var colorSheet = sheet.getSheetByName('Colors');
  if (!colorSheet) {
    colorSheet = sheet.insertSheet('Colors');
    colorSheet.appendRow(['Color Name']);
    colorSheet.appendRow(['สีทองกากเพชร (ยอดนิยม)']);
    colorSheet.appendRow(['สีเงินกากเพชร']);
    colorSheet.appendRow(['สีชมพูพาสเทล']);
    colorSheet.appendRow(['สีขาวโฟมธรรมชาติ']);
    colorSheet.appendRow(['สีแดง']);
    colorSheet.appendRow(['สีน้ำเงิน']);
  }
  return colorSheet;
}

function createOrdersSheet(sheet) {
  var orderSheet = sheet.getSheetByName('Orders');
  if (!orderSheet) {
    orderSheet = sheet.insertSheet('Orders');
    orderSheet.appendRow([
      'id', 
      'customerName', 
      'groomName', 
      'brideName', 
      'requiredDate', 
      'size', 
      'color', 
      'notes', 
      'status', 
      'createdDate', 
      'images'
    ]);
  }
  return orderSheet;
}

function createConfigSheet(sheet) {
  var configSheet = sheet.getSheetByName('Config');
  if (!configSheet) {
    configSheet = sheet.insertSheet('Config');
    configSheet.appendRow(['Key', 'Value']);
    configSheet.appendRow(['lineNotifyEnabled', false]);
    configSheet.appendRow(['lineChannelAccessToken', '']);
    configSheet.appendRow(['lineRecipientId', '']);
  }
  return configSheet;
}

function createBillsSheet(sheet) {
  var billsSheet = sheet.getSheetByName('Bills');
  if (!billsSheet) {
    billsSheet = sheet.insertSheet('Bills');
    billsSheet.appendRow([
      'billId', 
      'createdDate', 
      'customerName', 
      'items', 
      'shipping', 
      'discount', 
      'total',
      'paymentBank',
      'paymentAccountNumber',
      'paymentAccountName',
      'paymentQrUrl'
    ]);
  }
  return billsSheet;
}

function handleLineWebhook(events) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = sheet.getSheetByName('Config') || createConfigSheet(sheet);
  var configData = configSheet.getDataRange().getValues();
  
  // Extract lineChannelAccessToken to reply back if needed
  var lineChannelAccessToken = "";
  for (var i = 1; i < configData.length; i++) {
    var key = String(configData[i][0]).trim();
    if (key.toLowerCase() === 'linechannelaccesstoken') {
      lineChannelAccessToken = String(configData[i][1]).trim();
    }
  }
  
  events.forEach(function(event) {
    var source = event.source || {};
    var replyToken = event.replyToken;
    var targetId = "";
    
    if (source.type === 'group' && source.groupId) {
      targetId = source.groupId;
    } else if (source.type === 'room' && source.roomId) {
      targetId = source.roomId;
    } else if (source.type === 'user' && source.userId) {
      targetId = source.userId;
    }
    
    if (targetId) {
      // Update lineRecipientId in Config sheet
      var updated = false;
      var data = configSheet.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        var k = String(data[r][0]).trim().toLowerCase();
        if (k === 'linerecipientid') {
          configSheet.getRange(r + 1, 2).setValue(targetId);
          updated = true;
          break;
        }
      }
      
      if (!updated) {
        configSheet.appendRow(['lineRecipientId', targetId]);
      }
      
      // Reply to group/user if join event or text command
      var shouldReply = false;
      var replyText = "";
      
      if (event.type === 'join') {
        shouldReply = true;
        replyText = "บอทเชื่อมต่อสำเร็จ! ได้ทำการบันทึกไอดีห้อง/กลุ่มในฐานข้อมูลแผ่นงานเรียบร้อยแล้ว\nID: " + targetId;
      } else if (event.type === 'message' && event.message && event.message.type === 'text') {
        var msgText = String(event.message.text).trim();
        if (msgText === 'ดึงไอดี' || msgText === 'get id' || msgText === 'id') {
          shouldReply = true;
          replyText = "บันทึกไอดีผู้รับปลายทาง (Recipient ID) ลงในแผ่นงานเรียบร้อยแล้วครับ!\nID: " + targetId;
        }
      }
      
      if (shouldReply && replyToken && lineChannelAccessToken) {
        sendLineReplyMessage(lineChannelAccessToken, replyToken, replyText);
      }
    }
  });
}

function sendLineReplyMessage(token, replyToken, text) {
  var url = 'https://api.line.me/v2/bot/message/reply';
  var payload = {
    replyToken: replyToken,
    messages: [
      {
        type: 'text',
        text: text
      }
    ]
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    Logger.log("Reply response: " + response.getContentText());
  } catch (err) {
    Logger.log("Error replying to LINE: " + err.toString());
  }
}
