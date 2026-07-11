import { expect, test } from "@playwright/test";

const ATTACHMENT_DATABASE = "graph-atlas-attachments";
const ATTACHMENT_STORE = "attachmentCopies";
const ATTACHMENT_DIRECTORY_DATABASE = "graph-atlas-attachment-directory";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async ({ attachmentDatabase, directoryDatabase }) => {
    localStorage.clear();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(attachmentDatabase);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Unable to delete database."));
      request.onblocked = () => resolve();
    });
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(directoryDatabase);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Unable to delete directory database."));
      request.onblocked = () => resolve();
    });
  }, {
    attachmentDatabase: ATTACHMENT_DATABASE,
    directoryDatabase: ATTACHMENT_DIRECTORY_DATABASE,
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();
});

test("stores a selected inbox file in IndexedDB and keeps it searchable after confirmation", async ({
  page,
}) => {
  const uniqueId = Date.now();
  const title = `Smoke 附件资料 ${uniqueId}`;
  const fileName = `indexeddb-smoke-${uniqueId}.txt`;
  const previewKeyword = `IndexedDBUploadSmoke-${uniqueId}`;
  const fileContent = `酒店订单附件内容 ${previewKeyword}`;

  await page.getByRole("button", { name: /收集箱/ }).click();

  const inboxForm = page.locator(".inbox-form");
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
  await inboxForm.getByLabel("标题").fill(title);
  await inboxForm.getByLabel("类型").selectOption({ label: "文件" });
  await inboxForm.getByLabel("隐私级别").selectOption({ label: "低（可导出）" });
  await inboxForm.getByLabel("摘要").fill("浏览器 smoke 附件上传资料");
  await inboxForm.getByRole("button", { name: "加入收集箱" }).click();

  const inboxItem = page.locator(".inbox-item").filter({ hasText: title });
  await expect(inboxItem).toBeVisible();

  await inboxItem.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from(fileContent),
  });

  await expect
    .poll(() =>
      inboxItem.locator('input[name="attachmentName"]').evaluateAll((inputs, expectedName) =>
        inputs.some((input) => input.value === expectedName),
      fileName),
    )
    .toBe(true);

  const localCopy = await readIndexedDbLocalCopyManifest(inboxItem);
  expect(localCopy).toEqual(
    expect.objectContaining({
      mimeType: "text/plain",
      contentEncoding: "indexeddb",
      contentBase64: "",
      copyStatus: "stored-indexeddb",
    }),
  );
  expect(localCopy.storageKey).toContain(encodeURIComponent(fileName));
  expect(localCopy.contentHash).toMatch(/^djb2-[a-f0-9]{8}$/);
  expect(localCopy.textPreview).toContain(previewKeyword);

  const indexedDbRecord = await readIndexedDbAttachmentCopy(page, localCopy.storageKey);
  expect(indexedDbRecord).toEqual(
    expect.objectContaining({
      storageKey: localCopy.storageKey,
      manifest: expect.objectContaining({
        contentEncoding: "indexeddb",
        contentHash: localCopy.contentHash,
        textPreview: expect.stringContaining(previewKeyword),
      }),
    }),
  );
  expect(indexedDbRecord.bytes.length).toBe(Buffer.byteLength(fileContent));

  await inboxItem.getByRole("button", { name: "确认入库" }).click();

  await expect(
    page.getByText(`本地副本已保存到 IndexedDB · ${localCopy.contentHash}`),
  ).toBeVisible();

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill(previewKeyword);
  await expect(page.getByRole("region", { name: "搜索结果" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(fileName) })).toBeVisible();

  await page.reload();

  const persistedRecord = await readIndexedDbAttachmentCopy(page, localCopy.storageKey);
  expect(persistedRecord.manifest.contentHash).toBe(localCopy.contentHash);
  expect(persistedRecord.manifest.textPreview).toContain(previewKeyword);
});

test("keeps an oversized inbox file indexed while surfacing the external storage gap", async ({
  page,
}) => {
  const uniqueId = Date.now();
  const title = `Smoke 大文件资料 ${uniqueId}`;
  const fileName = `large-storage-gap-${uniqueId}.txt`;
  const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, "x");

  await page.getByRole("button", { name: /收集箱/ }).click();

  const inboxForm = page.locator(".inbox-form");
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
  await inboxForm.getByLabel("标题").fill(title);
  await inboxForm.getByLabel("类型").selectOption({ label: "文件" });
  await inboxForm.getByLabel("隐私级别").selectOption({ label: "低（可导出）" });
  await inboxForm.getByLabel("摘要").fill("浏览器 smoke 大文件占位资料");
  await inboxForm.getByRole("button", { name: "加入收集箱" }).click();

  const inboxItem = page.locator(".inbox-item").filter({ hasText: title });
  await expect(inboxItem).toBeVisible();

  await inboxItem.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: largeBuffer,
  });

  await expect
    .poll(() =>
      inboxItem.locator('input[name="attachmentName"]').evaluateAll((inputs, expectedName) =>
        inputs.some((input) => input.value === expectedName),
      fileName),
    )
    .toBe(true);
  await expect(inboxItem.getByText("未保存完整副本")).toBeVisible();
  await expect(inboxItem.getByText("后续等待文件系统或后端存储 adapter")).toBeVisible();

  const localCopy = await readLargeFileLocalCopyManifest(inboxItem);
  expect(localCopy).toEqual(
    expect.objectContaining({
      mimeType: "text/plain",
      byteSize: largeBuffer.length,
      contentHash: "",
      contentEncoding: "",
      contentBase64: "",
      copyStatus: "skipped-too-large",
      copyLimitBytes: 5 * 1024 * 1024,
    }),
  );
  expect(localCopy.storageKey).toContain(encodeURIComponent(fileName));

  await inboxItem.getByRole("button", { name: "确认入库" }).click();

  await expect(page.getByText("未保存完整副本 / 需要外部存储")).toBeVisible();
  await expect(page.getByText("已保留附件索引和本地引用")).toBeVisible();
  await expect(page.getByText("文件超过 5 MB，未保存本地副本")).toBeVisible();

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill(fileName);
  await expect(page.getByRole("region", { name: "搜索结果" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(fileName) })).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();
  const settingsView = page.locator(".settings-view");
  await expect(settingsView.getByText("大文件长期保存", { exact: true })).toBeVisible();
  await expect(settingsView.getByText("1 个大文件未保存完整副本")).toBeVisible();
  await expect(settingsView.getByText("文件系统 adapter 或后端同步启用后再保存完整副本。"))
    .toBeVisible();
  await expect(settingsView.getByText("文件系统 adapter", { exact: true })).toBeVisible();
  await expect(settingsView.getByText("后端同步 adapter", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.showDirectoryPicker = async () => navigator.storage.getDirectory();
  });
  await settingsView.getByRole("button", { name: "选择附件目录" }).click();
  await expect(settingsView.getByText("本地附件目录已授权。后续新选择的大文件会保存完整副本。"))
    .toBeVisible();

  await settingsView.getByLabel("选择历史大文件补拷贝").setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: largeBuffer,
  });

  await expect(settingsView.getByText(`已补拷贝 1 个历史大文件完整副本：${fileName}。`)).toBeVisible();

  const backfilledAttachment = await page.evaluate((expectedFileName) => {
    const store = JSON.parse(localStorage.getItem("graph-atlas-store"));

    return store.attachments.find((attachment) => attachment.name === expectedFileName);
  }, fileName);

  expect(backfilledAttachment.localCopy).toEqual(
    expect.objectContaining({
      contentEncoding: "file-system",
      copyStatus: "stored-file-system",
    }),
  );
});

test("stores an oversized inbox file in a configured local attachment directory", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => navigator.storage.getDirectory();
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();

  const uniqueId = Date.now();
  const title = `Smoke 本地目录资料 ${uniqueId}`;
  const fileName = `local-directory-large-${uniqueId}.txt`;
  const previewKeyword = `LocalDirectorySmoke-${uniqueId}`;
  const largeBuffer = Buffer.concat([
    Buffer.from(`本地目录大文件内容 ${previewKeyword}\n`),
    Buffer.alloc(5 * 1024 * 1024 + 1, "y"),
  ]);

  await page.getByRole("button", { name: "设置" }).click();
  const settingsView = page.locator(".settings-view");
  await settingsView.getByRole("button", { name: "选择附件目录" }).click();
  await expect(settingsView.getByText("本地附件目录已授权。后续新选择的大文件会保存完整副本。"))
    .toBeVisible();
  await expect(settingsView.getByText("已授权 · 只保存到本机，不会自动云同步")).toBeVisible();
  await expect(settingsView.getByText("本地附件目录已启用")).toBeVisible();

  await settingsView.getByRole("button", { name: "收集箱" }).click();

  const inboxForm = page.locator(".inbox-form");
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
  await inboxForm.getByLabel("标题").fill(title);
  await inboxForm.getByLabel("类型").selectOption({ label: "文件" });
  await inboxForm.getByLabel("隐私级别").selectOption({ label: "低（可导出）" });
  await inboxForm.getByLabel("摘要").fill("浏览器 smoke 本地目录附件资料");
  await inboxForm.getByRole("button", { name: "加入收集箱" }).click();

  const inboxItem = page.locator(".inbox-item").filter({ hasText: title });
  await expect(inboxItem).toBeVisible();

  await inboxItem.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: largeBuffer,
  });

  await expect(inboxItem.getByText("完整副本将保存到本地附件目录")).toBeVisible();

  const localCopy = await readFileSystemLocalCopyManifest(inboxItem);
  expect(localCopy).toEqual(
    expect.objectContaining({
      mimeType: "text/plain",
      byteSize: largeBuffer.length,
      contentEncoding: "file-system",
      contentBase64: "",
      copyStatus: "stored-file-system",
      copyLimitBytes: 0,
    }),
  );
  expect(localCopy.storageKey).toMatch(/^file-system:\/\/graph-atlas\/attachments\/djb2-/);
  expect(localCopy.contentHash).toMatch(/^djb2-[a-f0-9]{8}$/);
  expect(localCopy.textPreview).toContain(previewKeyword);

  await inboxItem.getByRole("button", { name: "确认入库" }).click();

  await expect(page.getByText(`本地副本已保存到本地附件目录 · ${localCopy.contentHash}`))
    .toBeVisible();
  await expect(page.getByText("完整副本已保存").first()).toBeVisible();

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill(previewKeyword);
  await expect(page.getByRole("region", { name: "搜索结果" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(fileName) })).toBeVisible();
});

test("stores an oversized inbox file through a configured remote attachment endpoint", async ({
  page,
}) => {
  const uniqueId = Date.now();
  const title = `Smoke 后端附件资料 ${uniqueId}`;
  const fileName = `remote-large-${uniqueId}.txt`;
  const previewKeyword = `RemoteUploadSmoke-${uniqueId}`;
  const largeBuffer = Buffer.concat([
    Buffer.from(`后端上传大文件内容 ${previewKeyword}\n`),
    Buffer.alloc(5 * 1024 * 1024 + 1, "z"),
  ]);

  await page.route("**/mock-attachment-upload", async (route) => {
    const requestBody = route.request().postDataJSON();

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        storageKey: `remote://graph-atlas/attachments/${encodeURIComponent(fileName)}`,
        contentHash: requestBody.contentHash,
        textPreview: requestBody.textPreview,
      }),
    });
  });

  await page.getByRole("button", { name: "设置" }).click();
  const settingsView = page.locator(".settings-view");
  await settingsView.getByLabel("后端上传 endpoint").fill("/mock-attachment-upload");
  await settingsView.getByLabel("后端上传 token").fill("smoke-token");
  await settingsView.getByRole("button", { name: "保存后端配置" }).click();
  await expect(settingsView.getByText("后端附件上传配置已保存")).toBeVisible();
  await expect(settingsView.getByText("已配置 · 可选客户端 endpoint")).toBeVisible();

  await settingsView.getByRole("button", { name: "收集箱" }).click();

  const inboxForm = page.locator(".inbox-form");
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
  await inboxForm.getByLabel("标题").fill(title);
  await inboxForm.getByLabel("类型").selectOption({ label: "文件" });
  await inboxForm.getByLabel("隐私级别").selectOption({ label: "低（可导出）" });
  await inboxForm.getByLabel("摘要").fill("浏览器 smoke 后端附件资料");
  await inboxForm.getByRole("button", { name: "加入收集箱" }).click();

  const inboxItem = page.locator(".inbox-item").filter({ hasText: title });
  await expect(inboxItem).toBeVisible();

  await inboxItem.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: largeBuffer,
  });

  const localCopy = await readRemoteLocalCopyManifest(inboxItem);
  expect(localCopy).toEqual(
    expect.objectContaining({
      storageKey: `remote://graph-atlas/attachments/${encodeURIComponent(fileName)}`,
      mimeType: "text/plain",
      byteSize: largeBuffer.length,
      contentEncoding: "remote",
      contentBase64: "",
      copyStatus: "stored-remote",
      copyLimitBytes: 0,
    }),
  );
  expect(localCopy.textPreview).toContain(previewKeyword);

  await inboxItem.getByRole("button", { name: "确认入库" }).click();

  await expect(page.getByText(`完整副本已保存到后端附件存储 · ${localCopy.contentHash}`))
    .toBeVisible();

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill(previewKeyword);
  await expect(page.getByRole("region", { name: "搜索结果" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(fileName) })).toBeVisible();
});

async function readIndexedDbLocalCopyManifest(inboxItem) {
  await expect.poll(() => readSerializedIndexedDbManifest(inboxItem)).not.toBe("");
  const serialized = await readSerializedIndexedDbManifest(inboxItem);

  return JSON.parse(serialized);
}

async function readLargeFileLocalCopyManifest(inboxItem) {
  await expect.poll(() => readSerializedLocalCopyManifest(inboxItem, "skipped-too-large"))
    .not.toBe("");
  const serialized = await readSerializedLocalCopyManifest(inboxItem, "skipped-too-large");

  return JSON.parse(serialized);
}

async function readFileSystemLocalCopyManifest(inboxItem) {
  await expect.poll(() => readSerializedLocalCopyManifest(inboxItem, "file-system"))
    .not.toBe("");
  const serialized = await readSerializedLocalCopyManifest(inboxItem, "file-system");

  return JSON.parse(serialized);
}

async function readRemoteLocalCopyManifest(inboxItem) {
  await expect.poll(() => readSerializedLocalCopyManifest(inboxItem, '"contentEncoding":"remote"'))
    .not.toBe("");
  const serialized = await readSerializedLocalCopyManifest(inboxItem, '"contentEncoding":"remote"');

  return JSON.parse(serialized);
}

async function readSerializedIndexedDbManifest(inboxItem) {
  return readSerializedLocalCopyManifest(inboxItem, "indexeddb");
}

async function readSerializedLocalCopyManifest(inboxItem, marker) {
  return inboxItem
    .locator('input[name="attachmentLocalCopy"]')
    .evaluateAll(
      (inputs, expectedMarker) =>
        inputs
          .map((input) => input.value)
          .find((value) => value.includes(expectedMarker)) || "",
      marker,
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
