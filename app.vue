<template>
  <div @dragover.prevent @drop.prevent>
    <NuxtRouteAnnouncer />
    <main class="main-container">
      <header class="header">
        <h1>画像モザイク処理</h1>
        <p>画像をアップロードして、選択した領域にモザイク処理を適用できます</p>
      </header>
      <ImageMosaic />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
    Cantarell, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f5f5f5;
}

.main-container {
  min-height: 100vh;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
  color: #2c3e50;
}

.header p {
  font-size: 1.1em;
  color: #666;
  max-width: 600px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .header h1 {
    font-size: 2em;
  }

  .header p {
    font-size: 1em;
  }
}

@media (prefers-color-scheme: dark) {
  body {
    background-color: #1a1a1a;
    color: #e0e0e0;
  }

  .header h1 {
    color: #ffffff;
  }

  .header p {
    color: #cccccc;
  }
}
</style>
