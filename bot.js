const { Telegraf } = require('telegraf');
const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
// 示例：将 111 转换为 BigNumber，并打印为字符串
console.log('22222222222:', ethers.BigNumber.from(111).toString());
// Bot Token
const bot = new Telegraf('7831280551:AAFB_grlyCICooJw2PAPsCAaKtQhi1aFhH0');

// 设置 Ethereum Provider
const provider = new ethers.providers.JsonRpcProvider('https://smartbch.greyh.at');


// 合约地址和 ABI（请替换为你自己的智能合约地址和 ABI）
const contractAddress = '0xE70b5566c4802357cD63b4bdebDc5c5Ee13D9EBb';
// 读取 ABI 文件
const abiPath = path.join(__dirname, 'abi', 'ClubhouseFarming.json');
const contractABI = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));

// 创建 Contract 实例
const contract = new ethers.Contract(contractAddress, contractABI, provider);

// 模拟存储：用于存储用户的挑战字符串和绑定结果
const userChallenges = {}; // { telegram_id: { challenge: "random_string", wallet: "0x..." } }
const userBindings = {}; // { telegram_id: wallet_address }

// 生成随机挑战字符串
function generateChallenge() {
    return crypto.randomBytes(16).toString('hex');
}

// 使用 Map 来存储群组的踢人条件
const groupConditions = new Map();
// 生成 VIP 等级的踢人条件
groupConditions.set('-1002381046161', { lockAmountThreshold: 10 });  // 10 veEBEN
groupConditions.set('-1002489692350', { lockAmountThreshold: 100 }); // 100 veEBEN
groupConditions.set('VIP2', { lockAmountThreshold: 1000 }); // 1000 veEBEN
groupConditions.set('VIP3', { lockAmountThreshold: 10000 }); // 10000 veEBEN


// 第一步：生成签名 hash
bot.command('bind_wallet', (ctx) => {
    const userId = ctx.from.id;
    const challenge = generateChallenge();
    // 保存挑战字符串
    userChallenges[userId] = { challenge };
    ctx.reply(`${challenge}生成签名信息，并将签名hash发送给我:http://localhost:3000`);
});

// get
bot.command('get_wallet', (ctx) => {
    const userId = ctx.from.id;
    const wallet = userBindings[userId];

    if (wallet) {
        ctx.reply(`您绑定的钱包地址为：${wallet}`);
    } else {
        ctx.reply('您尚未绑定钱包地址，请使用 /bind_wallet 进行绑定。');
    }
});

// delete
bot.command('del_wallet', (ctx) => {
    const userId = ctx.from.id;
    const wallet = userBindings[userId];
    if (wallet) {
        delete userBindings[userId];
        ctx.reply(`您解绑钱包地址为：${wallet}`);
    } else {
        ctx.reply('您尚未绑定钱包地址，请使用 /bind_wallet 进行绑定。');
    }
});

// 监听新成员加入群组
bot.on('new_chat_members', async (ctx) => {
    console.log("来了来了")
    const newMember = ctx.message.new_chat_members[0];
    const userId = newMember.id;
    if(!userBindings[userId]){
        ctx.reply('请先绑定钱包！我将在 30 秒后踢出您，如果您未绑定钱包。');
        // 设置倒计时，5秒后踢出该用户
        setTimeout(async () => {
            if (!userBindings[userId]) {  // 如果用户在倒计时结束时仍未绑定钱包
                try {
                    // 使用 banChatMember 方法踢出用户，直到指定的时间（此处为立即踢出）
                    await bot.telegram.banChatMember(chatId, userId, { until_date: Math.floor(5000 / 1000) });
                    console.log(`用户 ${userId} 已被踢出`);
                } catch (err) {console.error('踢出失败:', err);}
            }
        }, 5000); 
        return; 
    }
    const wallet=userBindings[userId];

    try {
        const groupId = ctx.chat.id; 
        console.log("groupId：：：：：",groupId)
        console.log("groupId：：：：：",wallet)
        const checkAmount=groupConditions.get(groupId);
        // 读取智能合约中的用户锁仓数量
        const lockedAmount = await getVeEBENAmount(wallet);

        // 判断锁仓数量是否满足条件
        console.log("lockedAmountlockedAmountlockedAmount",checkAmount)
        if (lockedAmount.lt(ethers.BigNumber.from(checkAmount.lockAmountThreshold))) {
            console.log(`锁仓数量 ${lockedAmount.toString()} 小于阈值，踢出该用户`);
            // 踢出用户
            await ctx.kickChatMember(ctx.message.from.id);
            console.log(`用户 ${ctx.message.from.username} 已被踢出群组`);
        } else {
            console.log(`锁仓数量 ${lockedAmount.toString()} 满足条件，保留在群组`);
        }
    } catch (error) {
        console.error('处理用户时出错:', error);
    }
});

// 解封指定用户
bot.command('unban_user', async (ctx) => {
    // 获取要解封的用户 ID
    const userId = ctx.message.reply_to_message.from.id;  // 如果是回复消息中的用户
    const chatId = ctx.chat.id;
  
    await bot.telegram.unbanChatMember('-1002489692350', userId);
    console.log(`用户 ${userId} 已被解除封禁`);
    ctx.reply('用户已解除封禁');
});

// // 第二步：接收签名并验证
bot.on('text', async (ctx) => {
    // if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
    //     const groupId = ctx.chat.id;  // 获取群组的 ID
    //     console.log('群组 ID:', groupId);
    // }
    const userIs = ctx.from.id;  // 获取发送消息的用户的 userId
    console.log('用户 ID:', userIs);
    try {
        // 解除封禁
        await bot.telegram.unbanChatMember(chatId, userId);
        console.log(`用户 ${userId} 已被解除封禁`);
        ctx.reply('用户已解除封禁');
      } catch (err) {
        console.error('解除封禁失败:', err);
        ctx.reply('解除封禁失败，请重试');
      }
    // 只处理私聊
    if (ctx.chat.type !== 'private') {
        return;  // 如果是群组消息，直接返回
    }
    const userId = ctx.from.id;
    const signedMessage = ctx.message.text.trim();

    if (!userChallenges[userId]) {
        ctx.reply('您需要先使用 /bind_wallet 生成挑战字符串。');
        return;
    }

    const { challenge } = userChallenges[userId];

    try {
        // 验证签名并获取签名的钱包地址
        const recoveredAddress = ethers.utils.verifyMessage(challenge, signedMessage);

        // 保存绑定关系
        userBindings[userId] = recoveredAddress;
        delete userChallenges[userId];

        ctx.reply(`绑定成功！您的钱包地址为：${recoveredAddress}`);
    } catch (error) {
        console.error('签名验证失败:', error);
        ctx.reply('签名验证失败，请确保您正确签名了机器人提供的挑战字符串。');
    }
});

// 读取智能合约中的锁仓数量
async function getVeEBENAmount(userAddress) {
    try {
        // 调用智能合约的 `userInfos` 方法，假设返回的是锁仓数量
        const lockedAmount = await contract.userInfos(userAddress);
        const amount=(ethers.BigNumber.from(lockedAmount[0])).div(ethers.BigNumber.from('10').pow(18));
        console.log('amount:',amount.toString());
        return  amount;  // 假设 `userInfos` 返回的是一个元组，锁仓数量在第一个位置
    } catch (error) {
        console.error('获取锁仓数量失败:', error);
        return  ethers.BigNumber.from(0);  // 如果获取失败，返回 0
    }
}

// 启动机器人
bot.launch()
    .then(() => console.log('Bot is running'))
    .catch((err) => console.error('Bot failed to start:', err));
