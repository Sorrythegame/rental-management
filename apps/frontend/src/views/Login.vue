<template>
  <div class="login-container">
    <a-card title="系统登录" style="width: 400px; margin: 100px auto;">
      <a-form :model="formState" @finish="handleLogin" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="用户名" name="username" :rules="[{ required: true, message: '请输入用户名!' }]">
          <a-input v-model:value="formState.username" />
        </a-form-item>
        <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码!' }]">
          <a-input-password v-model:value="formState.password" />
        </a-form-item>
        <a-form-item :wrapper-col="{ offset: 6, span: 18 }">
          <a-button type="primary" html-type="submit" :loading="loading" style="width: 100%;">登录</a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import JSEncrypt from 'jsencrypt';
import request from '../utils/request';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();
const formState = reactive({ username: '', password: '' });
const loading = ref(false);

const handleLogin = async (values: any) => {
  try {
    loading.value = true;
    // 获取公钥
    const keyRes = await request.get('/auth/public-key') as any;
    const publicKey = keyRes.publicKey;

    // RSA加密密码
    const encrypt = new JSEncrypt();
    encrypt.setPublicKey(publicKey);
    const encryptedPassword = encrypt.encrypt(values.password);

    if (!encryptedPassword) {
      message.error('密码加密失败');
      return;
    }

    // 登录
    const loginRes = await request.post('/auth/login', {
      username: values.username,
      password: encryptedPassword,
    }) as any;

    userStore.setToken(loginRes.access_token);
    message.success('登录成功');
    router.push('/');
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
}
</style>
