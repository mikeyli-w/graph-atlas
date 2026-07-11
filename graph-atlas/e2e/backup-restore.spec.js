import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const ATTACHMENT_DATABASE = "graph-atlas-attachments";
const ATTACHMENT_STORE = "attachmentCopies";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async (databaseName) => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }, ATTACHMENT_DATABASE);
  await page.reload();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();
});

test("exports and restores a local backup package with IndexedDB attachment copies", async ({
  page,
}) => {
  const uniqueId = Date.now();
  const title = `Backup 资料 ${uniqueId}`;
  const fileName = `backup-smoke-${uniqueId}.txt`;
  const previewKeyword = `BackupRestoreSmoke-${uniqueId}`;
  const fileContent = `备份恢复附件内容 ${previewKeyword}`;

  await page.getByRole("button", { name: /收集箱/ }).click();

  const inboxForm = page.locator(".inbox-form");
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
  await inboxForm.getByLabel("标题").fill(title);
  await inboxForm.getByLabel("类型").selectOption({ label: "文件" });
  await inboxForm.getByLabel("隐私级别").selectOption({ label: "低（可导出）" });
  await inboxForm.getByLabel("摘要").fill("浏览器 smoke 备份恢复资料");
  await inboxForm.getByRole("button", { name: "加入收集箱" }).click();

  const inboxItem = page.locator(".inbox-item").filter({ hasText: title });
  await expect(inboxItem).toBeVisible();
  await inboxItem.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from(fileContent),
  });

  const localCopy = await readIndexedDbLocalCopyManifest(inboxItem);
  await inboxItem.getByRole("button", { name: "确认入库" }).click();
  await expect(page.getByText(`本地副本已保存到 IndexedDB · ${localCopy.contentHash}`))
    .toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();
  const settingsView = page.locator(".settings-view");
  await expect(settingsView.getByRole("heading", { name: "设置" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await settingsView.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  const backupJson = JSON.parse(await readFile(backupPath, "utf8"));

  const suggestedBackupFileName = download.suggestedFilename();
  expect(suggestedBackupFileName).toMatch(/^graph-atlas-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(
    settingsView.getByText(`备份已导出：${suggestedBackupFileName}。备份文件为本地明文 JSON，请妥善保存。`),
  ).toBeVisible();
  expect(backupJson).toEqual(
    expect.objectContaining({
      format: "graph-atlas-backup",
      formatVersion: 1,
      store: expect.objectContaining({
        entities: expect.arrayContaining([expect.objectContaining({ title })]),
      }),
      attachmentCopies: expect.arrayContaining([
        expect.objectContaining({
          storageKey: localCopy.storageKey,
          manifest: expect.objectContaining({
            contentEncoding: "indexeddb",
            contentHash: localCopy.contentHash,
          }),
          bytesBase64: Buffer.from(fileContent).toString("base64"),
        }),
      ]),
    }),
  );

  await settingsView.getByRole("button", { name: "重置资料" }).click();
  await expect(settingsView.getByText("确认重置资料库？")).toBeVisible();
  await settingsView.getByRole("button", { name: "取消" }).click();
  await expect(settingsView.getByText("确认重置资料库？")).toHaveCount(0);
  await expect(settingsView.getByText("已取消重置资料库，当前资料库未更改。")).toBeVisible();
  await expect(settingsView.getByText("14", { exact: true }).first()).toBeVisible();
  await settingsView.getByRole("button", { name: "重置资料" }).click();
  await settingsView.getByRole("button", { name: "确认重置" }).click();
  await expect(settingsView.getByText("资料库已重置为示例数据。")).toBeVisible();
  await expect(settingsView.getByText("13", { exact: true }).first()).toBeVisible();

  await settingsView.getByLabel("导入备份文件").setInputFiles(backupPath);
  await expect(settingsView.getByText(/确认恢复这个备份/)).toBeVisible();
  await expect(settingsView.getByText(/14 份资料/)).toBeVisible();
  await expect(settingsView.getByText(/1 个附件副本/)).toBeVisible();
  await settingsView.getByRole("button", { name: "取消" }).click();
  await expect(settingsView.getByText("已取消备份恢复，当前资料库未更改。")).toBeVisible();
  await expect(settingsView.getByText(/确认恢复这个备份/)).toHaveCount(0);
  await expect(settingsView.getByText("13", { exact: true }).first()).toBeVisible();

  await settingsView.getByLabel("导入备份文件").setInputFiles(backupPath);
  await expect(settingsView.getByText(/确认恢复这个备份/)).toBeVisible();
  await settingsView.getByRole("button", { name: "确认恢复" }).click();

  await expect(page.getByText("备份已恢复，当前资料库已替换为备份内容。")).toBeVisible();
  await expect(page.getByText("已取消备份恢复，当前资料库未更改。")).toHaveCount(0);
  await expect(settingsView.getByText("资料库已重置为示例数据。")).toHaveCount(0);
  await page.getByRole("button", { name: "MAP 图谱" }).click();

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill(previewKeyword);
  await expect(page.getByRole("region", { name: "搜索结果" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(`${fileName}.*${title}.*低（可导出）`) }),
  ).toBeVisible();

  const restoredRecord = await readIndexedDbAttachmentCopy(page, localCopy.storageKey);
  expect(restoredRecord).toEqual(
    expect.objectContaining({
      storageKey: localCopy.storageKey,
      manifest: expect.objectContaining({
        contentEncoding: "indexeddb",
        contentHash: localCopy.contentHash,
        textPreview: expect.stringContaining(previewKeyword),
      }),
      bytes: Array.from(Buffer.from(fileContent)),
    }),
  );
});

test("exports and restores an encrypted backup package after password preview", async ({
  page,
}) => {
  const uniqueId = Date.now();
  const title = `Encrypted Backup 资料 ${uniqueId}`;
  const fileName = `encrypted-backup-${uniqueId}.txt`;
  const previewKeyword = `EncryptedBackupRestoreSmoke-${uniqueId}`;
  const fileContent = `加密备份恢复附件内容 ${previewKeyword}`;
  const backupPassword = `backup-password-${uniqueId}`;

  await page.getByRole("button", { name: /收集箱/ }).click();

  const inboxForm = page.locator(".inbox-form");
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
  await inboxForm.getByLabel("标题").fill(title);
  await inboxForm.getByLabel("类型").selectOption({ label: "文件" });
  await inboxForm.getByLabel("隐私级别").selectOption({ label: "低（可导出）" });
  await inboxForm.getByLabel("摘要").fill("浏览器 smoke 加密备份恢复资料");
  await inboxForm.getByRole("button", { name: "加入收集箱" }).click();

  const inboxItem = page.locator(".inbox-item").filter({ hasText: title });
  await expect(inboxItem).toBeVisible();
  await inboxItem.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from(fileContent),
  });

  const localCopy = await readIndexedDbLocalCopyManifest(inboxItem);
  await inboxItem.getByRole("button", { name: "确认入库" }).click();
  await expect(page.getByText(`本地副本已保存到 IndexedDB · ${localCopy.contentHash}`))
    .toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();
  const settingsView = page.locator(".settings-view");
  await expect(settingsView.getByRole("heading", { name: "设置" })).toBeVisible();

  await settingsView.getByLabel("加密导出").check();
  await settingsView.locator(".backup-panel").getByLabel("备份密码").fill(backupPassword);

  const downloadPromise = page.waitForEvent("download");
  await settingsView.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  const encryptedBackupText = await readFile(backupPath, "utf8");
  const encryptedBackupJson = JSON.parse(encryptedBackupText);
  const suggestedBackupFileName = download.suggestedFilename();

  expect(suggestedBackupFileName).toMatch(
    /^graph-atlas-backup-encrypted-\d{4}-\d{2}-\d{2}\.json$/,
  );
  expect(encryptedBackupJson).toEqual(
    expect.objectContaining({
      format: "graph-atlas-encrypted-backup",
      formatVersion: 1,
      encryption: expect.objectContaining({
        algorithm: "AES-GCM",
        kdf: "PBKDF2-SHA-256",
        iterations: 210000,
      }),
      ciphertextBase64: expect.any(String),
    }),
  );
  expect(encryptedBackupText).not.toContain(title);
  expect(encryptedBackupText).not.toContain(previewKeyword);
  await expect(
    settingsView.getByText(`加密备份已导出：${suggestedBackupFileName}。请妥善保存备份密码，应用无法找回。`),
  ).toBeVisible();

  await settingsView.getByRole("button", { name: "重置资料" }).click();
  await settingsView.getByRole("button", { name: "确认重置" }).click();
  await expect(settingsView.getByText("资料库已重置为示例数据。")).toBeVisible();
  await expect(settingsView.getByText("13", { exact: true }).first()).toBeVisible();

  await settingsView.getByLabel("导入备份文件").setInputFiles(backupPath);
  await expect(settingsView.getByText("这是加密备份，请输入备份密码后继续。")).toBeVisible();
  await expect(settingsView.getByText(/确认恢复这个备份/)).toHaveCount(0);

  const decryptCard = settingsView.locator(".backup-restore-card").filter({ hasText: "解密这个备份？" });
  await decryptCard.getByLabel("备份密码").fill("wrong-password");
  await decryptCard.getByRole("button", { name: "解密并预览" }).click();
  await expect(settingsView.getByText("备份密码不正确或文件已损坏。")).toBeVisible();
  await expect(settingsView.getByText(/确认恢复这个备份/)).toHaveCount(0);
  await expect(settingsView.getByText("13", { exact: true }).first()).toBeVisible();

  await decryptCard.getByLabel("备份密码").fill(backupPassword);
  await decryptCard.getByRole("button", { name: "解密并预览" }).click();
  await expect(settingsView.getByText("加密备份已解密，请确认是否恢复。")).toBeVisible();
  await expect(settingsView.getByText(/确认恢复这个备份/)).toBeVisible();
  await expect(settingsView.getByText(/14 份资料/)).toBeVisible();
  await expect(settingsView.getByText(/1 个附件副本/)).toBeVisible();

  await settingsView.getByRole("button", { name: "确认恢复" }).click();
  await expect(page.getByText("备份已恢复，当前资料库已替换为备份内容。")).toBeVisible();

  await page.getByRole("button", { name: "MAP 图谱" }).click();
  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill(previewKeyword);
  await expect(page.getByRole("region", { name: "搜索结果" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(`${fileName}.*${title}.*低（可导出）`) }),
  ).toBeVisible();

  const restoredRecord = await readIndexedDbAttachmentCopy(page, localCopy.storageKey);
  expect(restoredRecord).toEqual(
    expect.objectContaining({
      storageKey: localCopy.storageKey,
      manifest: expect.objectContaining({
        contentEncoding: "indexeddb",
        contentHash: localCopy.contentHash,
        textPreview: expect.stringContaining(previewKeyword),
      }),
      bytes: Array.from(Buffer.from(fileContent)),
    }),
  );
});

test("rejects invalid backup files without showing restore confirmation", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();
  const settingsView = page.locator(".settings-view");

  await expect(settingsView.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(settingsView.getByText("13", { exact: true }).first()).toBeVisible();

  await settingsView.getByLabel("导入备份文件").setInputFiles({
    name: "not-a-graph-atlas-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not json"),
  });

  await expect(settingsView.getByText("备份文件不是有效 JSON。")).toBeVisible();
  await expect(settingsView.getByText(/确认恢复这个备份/)).toHaveCount(0);
  await expect(settingsView.getByText("13", { exact: true }).first()).toBeVisible();

  await settingsView.getByLabel("导入备份文件").setInputFiles({
    name: "other-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "other-app-export", items: [] })),
  });

  await expect(settingsView.getByText("备份文件不是 Graph Atlas 备份。")).toBeVisible();
  await expect(settingsView.getByText("备份文件不是有效 JSON。")).toHaveCount(0);
  await expect(settingsView.getByText(/确认恢复这个备份/)).toHaveCount(0);
  await expect(settingsView.getByText("13", { exact: true }).first()).toBeVisible();

  await settingsView.getByLabel("导入备份文件").setInputFiles({
    name: "future-graph-atlas-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "graph-atlas-backup",
        formatVersion: 999,
        exportedAt: new Date().toISOString(),
        store: {},
        attachmentCopies: [],
      }),
    ),
  });

  await expect(settingsView.getByText("备份版本不受支持。")).toBeVisible();
  await expect(settingsView.getByText("备份文件不是 Graph Atlas 备份。")).toHaveCount(0);
  await expect(settingsView.getByText(/确认恢复这个备份/)).toHaveCount(0);
  await expect(settingsView.getByText("13", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "MAP 图谱" }).click();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();
});

async function readIndexedDbLocalCopyManifest(inboxItem) {
  await expect.poll(() => readSerializedIndexedDbManifest(inboxItem)).not.toBe("");
  const serialized = await readSerializedIndexedDbManifest(inboxItem);

  return JSON.parse(serialized);
}

async function readSerializedIndexedDbManifest(inboxItem) {
  return inboxItem
    .locator('input[name="attachmentLocalCopy"]')
    .evaluateAll(
      (inputs) =>
        inputs
          .map((input) => input.value)
          .find((value) => value.includes('"contentEncoding":"indexeddb"')) || "",
    );
}

async function readIndexedDbAttachmentCopy(page, storageKey) {
  return page.evaluate(
    async ({ databaseName, storeName, key }) =>
      new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(databaseName, 1);

        openRequest.onerror = () =>
          reject(openRequest.error || new Error("Unable to open attachment database."));
        openRequest.onsuccess = () => {
          const database = openRequest.result;

          try {
            const transaction = database.transaction(storeName, "readonly");
            const getRequest = transaction.objectStore(storeName).get(key);

            getRequest.onerror = () =>
              reject(getRequest.error || new Error("Unable to read attachment copy."));
            getRequest.onsuccess = () => {
              database.close();
              resolve(getRequest.result || null);
            };
          } catch (error) {
            database.close();
            reject(error);
          }
        };
      }),
    {
      databaseName: ATTACHMENT_DATABASE,
      storeName: ATTACHMENT_STORE,
      key: storageKey,
    },
  );
}
