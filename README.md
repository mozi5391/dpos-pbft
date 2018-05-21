## 1 介绍
感谢sqfasd！
作为学习使用
这个demo是将dpos的委托人思想和pbft的三阶段协议的结合

dpos存在理论上的漏洞，如果被黑客利用就很容易对系统造成分叉，引发双重支付的风险。

这个demo并不完整，因为代码并没有实现区块链的持久化、签名认证、区块同步等功能，只是一个基本的网络模型

## 2 DPOS分析

dpos引入了delegates这个名词，受托人类似于董事会board of directors，由全节点投票选出，delegates按照一定顺序来进行制造区块（像是工厂流水线A->B->C->A->B->C）

这里，引用“亿书DPOS”：
在亿书的DPOS机制中，一个区块的产生大概是以下流程：
 (1）注册受托人，并接受投票

    用户注册为受托人;
    接受投票（得票数排行前101位）;
    
（2）维持循环，调整受托人

    块周期：也称为时段周期（Slot），每个块需要10秒，为一个时段（Slot）；
    受托人周期：或叫循环周期（Round），每101个区块为一个循环周期（Round）。这些块均由101个代表随机生成，每个代表生成1个块。一个完整循环周期大概需要1010秒(101x10)，约16分钟；每个周期结束，前101名的代表都要重新调整一次；
    奖励周期：根据区块链高度，设置里程碑时间（Milestone），在某个时间点调整区块奖励。
    上述循环，块周期最小（10秒钟），受托人周期其次（16分钟），奖励周期最大（347天）。

我们发现，dpos采取委托人随机排序和最长链原则来防止恶意节点制造区块导致分叉问题，但是每个循环周期中委托人列表的顺序是固定的。
那么，

举个例子，排序后的委托人列表如下

```
1,6,9,10,50,70,31,22,13,25
```

黑客实际控制的节点为

```
1,10,70,31,13,25
```

黑客在1号节点造成网络分叉后，由于中间隔着几个忠诚的节点，分叉很快被最长链同步机制消除，但是如果黑客此时对这些间隔内的忠诚节点发起
DDOS攻击，那么他就可以使他们入侵的本来不连续的恶意节点连续地产生区块了，也就是说分叉将持续到6个区块后，这时两个分叉网络中的所有交易都将被
确认6次以上，这些交易中可能会包括相互冲突的交易。也就是说黑客只需要控制6个节点，配合DDOS就可以100%造成双重支付。


## 3 PBFT

加入PBFT后，DPOS算法的前半部分不变，即委托人名单的确定方式和排序算法不变。

变化的是后半部分，即区块的验证和持久化。
区块的验证，不再采用单一的签名验证，而是全节点投票的方式，每当新区块创造出来时，忠诚的节点并不会立即将其写入区块链，而是等待其他节点的投票。
当这个票数超过一定数量后，才进入执行阶段。

本算法假定错误节点数不超过f个，总结点数n>=3f+1

算法流程如下：

1. 当前时间片的锻造者将收集到的交易打包成block并进行广播（这一步与之前的算法一致）
2. 收到block的委托人节点如果还没有收到过这个block并且验证合法后，就广播一个prepare<h, d, s>消息，其中h为block的高度，d是block的摘要，s是本节点签名
3. 收到prepare消息后，节点开始在内存中累加消息数量，当收到超过f+1不同节点的prepare消息后，节点进入prepared状态，之后会广播一个commit<h, d, s>消息
4. 每个节点收到超过2f+1个不同节点的commit消息后，就认为该区块已经达成一致，进入committed状态，并将其持久化到区块链数据库中
5. 系统在在收到第一个高度为h的block时，启动一个定时器，当定时到期后，如果还没达成一致，就放弃本次共识。

注意：
本算法中取消了pbft的view，是因为加入了dpos的slot，因为在区块链中，区块的生成可以延迟到下一个时间片的，每一个时间片相当于一个视图，slot相当于视图编号

由于取消了视图变化，达成一次共识的性能也大幅度提升。假设系统中总共有N个节点，包括委托人节点和普通节点。系统的消息传播使用的gossip算法，一次广播需要传递的消息上限是N^2，对应的时间开销为O(logN)。假如普通节点只接收不转发，那么N可以降为委托人的节点总数n，因为系统中委托人数量一定时期内保持不变，可以认为一次广播的时间开销为常数t。确认一个block需要3轮广播，也就是总时间为3t。
block消息大小设为B，prepare和commit的消息大小设为b，那么总共的带宽消耗为(B+2b)N^2。


## 4 demo说明

安装

```
npm install
```

运行

```
// 帮助
node main.js -h

// 使用pbft, 默认不使用
node main.js -p

// 模拟错误节点，-b后跟节点id列表，逗号分隔
node main.js -b 1,2,3

// 组合使用pbft，和错误节点
node main.js -b 1,2,3 -p
```

### 5 演示

首先我们使用默认的dpos算法，模拟一个分叉攻击

```
node main.js -b 10
```

等到第10个节点锻造区块时，它会制造两个fork，并发往不同的节点，可以看出在高度为4的时候，就开始分叉了

```
fork on node: 10, height: 4, fork1: 58b1c8d429f7ed6d47bf6e7bead2139af420be453259ea0da42091ced3b28ed8, fork2: 61084a05844c436a36dc1f14ad151bda19ab3774aa15d8b1006cbe1dfb01b943
send fork1 to 2
send fork2 to 5
send fork1 to 6
send fork2 to 8
send fork1 to 9
node 0 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:58b1c8:10) -> 
node 1 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 2 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:58b1c8:10) -> 
node 3 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 4 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 5 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 6 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:58b1c8:10) -> 
node 7 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 8 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 9 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:58b1c8:10) -> 
node 10 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:58b1c8:10) -> 
node 11 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:58b1c8:10) -> 
node 12 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 13 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 14 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:58b1c8:10) -> 
node 15 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 16 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:58b1c8:10) -> 
node 17 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 18 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
node 19 (0:713304:0) -> (1:f76cf6:7) -> (2:f1d1bc:8) -> (3:cccd58:9) -> (4:61084a:10) -> 
```

接着，我们开启pbft选项，并指定4个“坏节点”

```
node main.js -p -b 1,5,7,10
```

经过几轮的分叉攻击后，我们看到所有正常的节点都是一致的，只有少数坏节点不一致

```
node 0 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 1 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:faf2c9:5) -> (10:0ed227:10) -> 
node 2 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 3 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 4 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 5 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:faf2c9:5) -> 
node 6 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 7 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:faf2c9:5) -> (10:0b98f7:7) -> 
node 8 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 9 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 10 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:faf2c9:5) -> (10:0ed227:10) -> 
node 11 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 12 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 13 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 14 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 15 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 16 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 17 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 18 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 
node 19 (0:713304:0) -> (1:bb9e59:17) -> (2:641aad:18) -> (3:e2614b:19) -> (4:ac5538:0) -> (5:c82859:1) -> (6:015639:2) -> (7:288ce7:3) -> (8:fdc189:4) -> (9:7eb1e1:6) -> (10:3d33b9:8) -> (11:851887:9) -> (12:37a10a:11) -> (13:7d0a62:12) -> (14:08376c:13) -> (15:7221d3:14) -> 

```
