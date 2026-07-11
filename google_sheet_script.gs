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
        // Reload values to match new columns dimensions
        data = orderSheet.getDataRange().getValues();
      }
      
      var targetId = params.id;
      var fileUrl = "";
      
      if (params.image && params.image.data && params.image.data.indexOf('base64,') > -1) {
        var folderName = "Logo Foam Uploads";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        var parts = params.image.data.split('base64,');
        var contentType = parts[0].split(':')[1].split(';')[0];
        var base64Data = parts[1];
        
        var decoded = Utilities.base64Decode(base64Data);
        var blob = Utilities.newBlob(decoded, contentType, "finished_" + targetId);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();
      }
      
      for (var i = 1; i < data.length; i++) {
        if (Number(data[i][0]) === Number(targetId)) {
          orderSheet.getRange(i + 1, finishedImageIdx + 1).setValue(fileUrl);
          return jsonResponse({ success: true, finishedImage: fileUrl });
        }
      }
      return jsonResponse({ success: false, error: 'Order not found' });
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
      configSheet.appendRow(['paymentAccountNumber', params.paymentAccountNumber || '']);
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
                      
    var textMessages = [
      {
        type: "text",
        text: messageText
      }
    ];
 
    // Send text notification with error logger
    sendLinePushMessage(lineChannelAccessToken, lineRecipientId, textMessages, configSheet);
  } catch (err) {
    Logger.log("Error in triggerLineNotification: " + err.toString());
    writeErrorToConfig(configSheet, "Script Crash: " + err.toString());
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

function sendLinePushMessage(token, toId, messagesArray, configSheet) {
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
      
      var options = {
        method: "post",
        headers: {
          "Authorization": "Bearer " + token
        },
        payload: {
          message: messageString.trim()
        },
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
