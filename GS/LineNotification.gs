// LineNotification.gs - LINE 推播通知系統

// ==================== 常數設定 ====================
const LINE_CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
const LINE_MESSAGING_API_URL = "https://api.line.me/v2/bot/message/push";

/**
 * 發送 LINE 推播訊息
 * @param {string} userId - LINE User ID
 * @param {Object} flexMessage - Flex Message 物件
 */
function sendLineNotification_(userId, flexMessage) {
  const payload = {
    to: userId,
    messages: [flexMessage]
  };
  
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(LINE_MESSAGING_API_URL, options);
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 200) {
      Logger.log(`✅ LINE 通知已發送給 ${userId}`);
      return { ok: true };
    } else {
      Logger.log(`❌ LINE 通知發送失敗: ${result.message}`);
      return { ok: false, error: result.message };
    }
  } catch (err) {
    Logger.log(`❌ LINE API 錯誤: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ==================== Flex Message 模板 ====================

/**
 * 🔔 忘記打卡提醒
 */
function createForgotPunchNotification(employeeName, date, punchType) {
  return {
    type: "flex",
    altText: `⚠️ ${employeeName}，您忘記${punchType}打卡了！`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "⚠️ 忘記打卡提醒",
            weight: "bold",
            size: "xl",
            color: "#FF6B6B",
            align: "center"
          }
        ],
        backgroundColor: "#FFF5F5",
        paddingAll: "20px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${employeeName}，您好！`,
            size: "lg",
            weight: "bold",
            margin: "md"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "日期",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: date,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "狀態",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: `忘記${punchType}打卡`,
                    wrap: true,
                    color: "#FF6B6B",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              }
            ]
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "text",
            text: "請盡快進行補打卡，避免影響出勤記錄！",
            size: "sm",
            color: "#666666",
            margin: "lg",
            wrap: true
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "uri",
              label: "立即補打卡",
              uri: "https://eric693.github.io/New_Attendance-System/"
            },
            color: "#4CAF50"
          },
          {
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: "uri",
              label: "查看打卡記錄",
              uri: "https://eric693.github.io/New_Attendance-System/"
            }
          }
        ],
        flex: 0
      }
    }
  };
}

/**
 * ✅ 補打卡審核通知（核准）
 */
function createPunchApprovedNotification(employeeName, date, time, punchType, reviewer) {
  return {
    type: "flex",
    altText: `✅ 您的補打卡申請已核准`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "✅ 審核通過",
            weight: "bold",
            size: "xl",
            color: "#FFFFFF",
            align: "center"
          }
        ],
        backgroundColor: "#4CAF50",
        paddingAll: "20px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${employeeName}，您好！`,
            size: "lg",
            weight: "bold",
            margin: "md"
          },
          {
            type: "text",
            text: "您的補打卡申請已通過審核",
            size: "sm",
            color: "#666666",
            margin: "md"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "日期",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: date,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "時間",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: time,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "類型",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: `${punchType}打卡`,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "審核人",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: reviewer,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "uri",
              label: "查看詳情",
              uri: "https://eric693.github.io/New_Attendance-System/"
            },
            color: "#4CAF50"
          }
        ],
        flex: 0
      }
    }
  };
}

/**
 * ❌ 補打卡審核通知（拒絕）
 */
function createPunchRejectedNotification(employeeName, date, time, punchType, reviewer, reason) {
  return {
    type: "flex",
    altText: `❌ 您的補打卡申請已被拒絕`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "❌ 審核未通過",
            weight: "bold",
            size: "xl",
            color: "#FFFFFF",
            align: "center"
          }
        ],
        backgroundColor: "#FF6B6B",
        paddingAll: "20px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${employeeName}，您好！`,
            size: "lg",
            weight: "bold",
            margin: "md"
          },
          {
            type: "text",
            text: "您的補打卡申請已被拒絕",
            size: "sm",
            color: "#666666",
            margin: "md"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "日期",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: date,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "時間",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: time,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "審核人",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: reviewer,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5
                  }
                ]
              },
              {
                type: "separator",
                margin: "md"
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                margin: "md",
                contents: [
                  {
                    type: "text",
                    text: "拒絕原因",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: reason || "未提供",
                    wrap: true,
                    color: "#FF6B6B",
                    size: "sm",
                    flex: 5
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: "uri",
              label: "查看詳情",
              uri: "https://eric693.github.io/New_Attendance-System/"
            }
          }
        ],
        flex: 0
      }
    }
  };
}

/**
 * ✅ 請假審核通知（核准）
 */
function createLeaveApprovedNotification(employeeName, leaveType, startDate, endDate, days, reviewer) {
  return {
    type: "flex",
    altText: `✅ 您的${leaveType}申請已核准`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "✅ 請假核准通知",
            weight: "bold",
            size: "xl",
            color: "#FFFFFF",
            align: "center"
          }
        ],
        backgroundColor: "#2196F3",
        paddingAll: "20px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${employeeName}，您好！`,
            size: "lg",
            weight: "bold",
            margin: "md"
          },
          {
            type: "text",
            text: "您的請假申請已通過審核",
            size: "sm",
            color: "#666666",
            margin: "md"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "假別",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: leaveType,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "期間",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: `${startDate} ~ ${endDate}`,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "天數",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: `${days} 天`,
                    wrap: true,
                    color: "#2196F3",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "審核人",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: reviewer,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5
                  }
                ]
              }
            ]
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "text",
            text: "🎉 祝您有個愉快的假期！",
            size: "sm",
            color: "#2196F3",
            margin: "lg",
            align: "center",
            weight: "bold"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "uri",
              label: "查看假期餘額",
              uri: "https://eric693.github.io/New_Attendance-System/"
            },
            color: "#2196F3"
          }
        ],
        flex: 0
      }
    }
  };
}

/**
 * ❌ 請假審核通知（拒絕）
 */
function createLeaveRejectedNotification(employeeName, leaveType, startDate, endDate, days, reviewer, reason) {
  return {
    type: "flex",
    altText: `❌ 您的${leaveType}申請已被拒絕`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "❌ 請假未核准",
            weight: "bold",
            size: "xl",
            color: "#FFFFFF",
            align: "center"
          }
        ],
        backgroundColor: "#FF9800",
        paddingAll: "20px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${employeeName}，您好！`,
            size: "lg",
            weight: "bold",
            margin: "md"
          },
          {
            type: "text",
            text: "您的請假申請未通過審核",
            size: "sm",
            color: "#666666",
            margin: "md"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "假別",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: leaveType,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "期間",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: `${startDate} ~ ${endDate}`,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "審核人",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: reviewer,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 5
                  }
                ]
              },
              {
                type: "separator",
                margin: "md"
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                margin: "md",
                contents: [
                  {
                    type: "text",
                    text: "拒絕原因",
                    color: "#999999",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: reason || "未提供",
                    wrap: true,
                    color: "#FF9800",
                    size: "sm",
                    flex: 5
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: "uri",
              label: "重新申請",
              uri: "https://eric693.github.io/New_Attendance-System/"
            }
          }
        ],
        flex: 0
      }
    }
  };
}

// ==================== 觸發通知函式 ====================

/**
 * 發送忘記打卡提醒
 */
function notifyForgotPunch(userId, employeeName, date, punchType) {
  const message = createForgotPunchNotification(employeeName, date, punchType);
  return sendLineNotification_(userId, message);
}

/**
 * 發送補打卡審核結果通知
 */
function notifyPunchReview(userId, employeeName, date, time, punchType, reviewer, isApproved, reason = "") {
  const message = isApproved 
    ? createPunchApprovedNotification(employeeName, date, time, punchType, reviewer)
    : createPunchRejectedNotification(employeeName, date, time, punchType, reviewer, reason);
  
  return sendLineNotification_(userId, message);
}

/**
 * 發送請假審核結果通知
 */
function notifyLeaveReview(userId, employeeName, leaveType, startDate, endDate, days, reviewer, isApproved, reason = "") {
  const message = isApproved
    ? createLeaveApprovedNotification(employeeName, leaveType, startDate, endDate, days, reviewer)
    : createLeaveRejectedNotification(employeeName, leaveType, startDate, endDate, days, reviewer, reason);
  
  return sendLineNotification_(userId, message);
}

// ==================== 定時檢查忘記打卡 ====================

/**
 * 每日檢查忘記打卡（設定觸發器：每天晚上 20:00 執行）
 */
function checkForgotPunchDaily() {
  const today = new Date();
  const dateStr = Utilities.formatDate(today, "GMT+8", "yyyy-MM-dd");
  
  const attendanceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
  const employeeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPLOYEES);
  
  if (!attendanceSheet || !employeeSheet) return;
  
  const employees = employeeSheet.getDataRange().getValues();
  const attendances = attendanceSheet.getDataRange().getValues();
  
  // 遍歷所有員工
  for (let i = 1; i < employees.length; i++) {
    const userId = employees[i][EMPLOYEE_COL.USER_ID];
    const name = employees[i][EMPLOYEE_COL.NAME];
    const status = employees[i][EMPLOYEE_COL.STATUS];
    
    if (status !== '啟用') continue;
    
    // 檢查今天的打卡記錄
    let hasPunchIn = false;
    let hasPunchOut = false;
    
    for (let j = 1; j < attendances.length; j++) {
      if (attendances[j][0] === userId && attendances[j][1] === dateStr) {
        const type = attendances[j][2];
        if (type === '上班') hasPunchIn = true;
        if (type === '下班') hasPunchOut = true;
      }
    }
    
    // 發送通知
    if (!hasPunchIn) {
      notifyForgotPunch(userId, name, dateStr, "上班");
      Logger.log(`📤 已提醒 ${name} 忘記上班打卡`);
    }
    
    if (!hasPunchOut) {
      notifyForgotPunch(userId, name, dateStr, "下班");
      Logger.log(`📤 已提醒 ${name} 忘記下班打卡`);
    }
  }
}

function testNotification() {
  notifyForgotPunch("U7211ffe337b29ad1f738815cb8bfdf81", "哈囉", "2025-10-11", "上班");
}