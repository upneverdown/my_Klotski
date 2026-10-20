// ================= 常量与配置 =================
const COLS = 4;            // 棋盘列数
const ROWS = 5;            // 棋盘行数
const CELL_SIZE = 80;      // 每个格子的像素大小
const DRAG_THRESHOLD = 20; // 触发移动的最小拖拽像素距离

// ================= 游戏状态 =================
let pieces = [];           // 棋子对象数组
let grid = [];             // 5×4 二维数组，记录每个格子被哪个棋子占据（-1 为空，0~9 为棋子 id）
let steps = 0;             // 当前步数
let isGameActive = false;  // 游戏是否进行中

// 拖拽状态
let isDragging = false;
let dragPiece = null;
let startX = 0;
let startY = 0;

// ================= 初始布局（经典"横刀立马"） =================
const initialLayout = [
    { id: 0, name: '曹', type: 'cao',     w: 2, h: 2, x: 1, y: 0 },
    { id: 1, name: '关', type: 'general', w: 2, h: 1, x: 1, y: 2 },
    { id: 2, name: '张', type: 'general', w: 1, h: 2, x: 0, y: 0 },
    { id: 3, name: '赵', type: 'general', w: 1, h: 2, x: 3, y: 0 },
    { id: 4, name: '马', type: 'general', w: 1, h: 2, x: 0, y: 2 },
    { id: 5, name: '黄', type: 'general', w: 1, h: 2, x: 3, y: 2 },
    { id: 6, name: '卒', type: 'soldier', w: 1, h: 1, x: 1, y: 3 },
    { id: 7, name: '卒', type: 'soldier', w: 1, h: 1, x: 2, y: 3 },
    { id: 8, name: '卒', type: 'soldier', w: 1, h: 1, x: 0, y: 4 },
    { id: 9, name: '卒', type: 'soldier', w: 1, h: 1, x: 3, y: 4 }
];

// ================= DOM 元素获取 =================
const boardEl      = document.getElementById('board');
const stepsEl      = document.getElementById('steps');
const startScreen  = document.getElementById('start-screen');
const startBtn     = document.getElementById('start-btn');
const bgm          = document.getElementById('bgm');
const winModal     = document.getElementById('win-modal');
const finalStepsEl = document.getElementById('final-steps');
const replayBtn    = document.getElementById('replay-btn');
const resetBtn     = document.getElementById('reset-btn');

// ================= 初始化游戏 =================
function initGame() {
    // 只移除棋子 DOM，保留 exit-gate
    const existingPieces = boardEl.querySelectorAll('.piece');
    existingPieces.forEach(function(el) {
        el.remove();
    });

    // 初始化二维网格，-1 表示空位
    grid = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < COLS; c++) {
            grid[r][c] = -1;
        }
    }

    pieces = [];
    steps = 0;
    stepsEl.textContent = '0';
    isGameActive = true;

    // 创建棋子 DOM 并更新网格数据
    initialLayout.forEach(function(data) {
        // 深拷贝一份，避免修改原始配置
        var piece = {
            id:   data.id,
            name: data.name,
            type: data.type,
            w:    data.w,
            h:    data.h,
            x:    data.x,
            y:    data.y,
            el:   null
        };

        // 创建 DOM 元素
        var el = document.createElement('div');
        el.className = 'piece ' + piece.type;
        el.textContent = piece.name;
        el.style.width  = (piece.w * CELL_SIZE) + 'px';
        el.style.height = (piece.h * CELL_SIZE) + 'px';
        el.dataset.id = piece.id;

        piece.el = el;
        pieces.push(piece);
        boardEl.appendChild(el);

        // 更新网格占用情况
        updateGridForPiece(piece, piece.x, piece.y);
    });

    // 更新所有棋子位置
    updateAllPiecesDOM();
}

// ================= 网格操作 =================

/**
 * 更新二维数组中某个棋子的占用情况
 * @param {Object} piece   棋子对象
 * @param {number} newX    新的左上角列坐标
 * @param {number} newY    新的左上角行坐标
 * @param {boolean} clearOld 是否先清除旧位置
 */
function updateGridForPiece(piece, newX, newY, clearOld) {
    if (clearOld === undefined) clearOld = true;

    if (clearOld) {
        // 先清除旧位置
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                if (grid[r][c] === piece.id) {
                    grid[r][c] = -1;
                }
            }
        }
    }
    // 填充新位置
    for (var ry = newY; ry < newY + piece.h; ry++) {
        for (var rx = newX; rx < newX + piece.w; rx++) {
            grid[ry][rx] = piece.id;
        }
    }
}

/**
 * 根据棋子数据更新 DOM 位置
 */
function updateAllPiecesDOM() {
    pieces.forEach(function(piece) {
        piece.el.style.left = (piece.x * CELL_SIZE) + 'px';
        piece.el.style.top  = (piece.y * CELL_SIZE) + 'px';
    });
}

// ================= 核心移动与碰撞检测逻辑 =================

/**
 * 检查棋子向指定方向移动是否合法（不越界且不碰撞）
 * @param {Object} piece     棋子对象
 * @param {string} direction 方向 ('up', 'down', 'left', 'right')
 * @returns {boolean} 是否可以移动
 */
function canMove(piece, direction) {
    var x = piece.x;
    var y = piece.y;
    var w = piece.w;
    var h = piece.h;
    var id = piece.id;
    var targets = []; // 需要检查的目标格子

    // 计算移动后需要占据的新格子，并检查是否越界
    if (direction === 'up') {
        if (y === 0) return false;
        for (var i = x; i < x + w; i++) {
            targets.push({ x: i, y: y - 1 });
        }
    } else if (direction === 'down') {
        if (y + h >= ROWS) return false;
        for (var j = x; j < x + w; j++) {
            targets.push({ x: j, y: y + h });
        }
    } else if (direction === 'left') {
        if (x === 0) return false;
        for (var k = y; k < y + h; k++) {
            targets.push({ x: x - 1, y: k });
        }
    } else if (direction === 'right') {
        if (x + w >= COLS) return false;
        for (var l = y; l < y + h; l++) {
            targets.push({ x: x + w, y: l });
        }
    }

    // 严谨的碰撞检测：目标格子必须全为空（-1），或者是当前棋子自己
    for (var m = 0; m < targets.length; m++) {
        var t = targets[m];
        var occupant = grid[t.y][t.x];
        if (occupant !== -1 && occupant !== id) {
            return false; // 被其他棋子阻挡
        }
    }
    return true;
}

/**
 * 执行移动操作
 * @returns {boolean} 是否成功移动
 */
function movePiece(piece, direction) {
    if (!canMove(piece, direction)) return false;

    // 更新棋子坐标
    if (direction === 'up')       piece.y--;
    else if (direction === 'down')  piece.y++;
    else if (direction === 'left')  piece.x--;
    else if (direction === 'right') piece.x++;

    // 更新网格数据
    updateGridForPiece(piece, piece.x, piece.y);

    // 更新 DOM 位置（CSS transition 会自动处理平滑动画）
    piece.el.style.left = (piece.x * CELL_SIZE) + 'px';
    piece.el.style.top  = (piece.y * CELL_SIZE) + 'px';

    // 步数 +1
    steps++;
    stepsEl.textContent = steps;

    // 检查胜利条件：曹操到达底部正中间出口 (x=1, y=3)
    if (piece.name === '曹' && piece.x === 1 && piece.y === 3) {
        triggerWin();
    }

    return true;
}

// ================= 交互逻辑（鼠标与触摸拖拽） =================

/**
 * 从鼠标或触摸事件中统一提取坐标
 * 【修复】补全了缺失的左括号，并兼容 changedTouches
 */
function getEventPos(e) {
    // touchstart / touchmove 使用 touches
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    // touchend 使用 changedTouches
    if (e.changedTouches && e.changedTouches.length > 0) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    // 鼠标事件
    return { x: e.clientX, y: e.clientY };
}

/**
 * 按下 / 触摸开始
 */
function handleStart(e) {
    if (!isGameActive) return;
    e.preventDefault(); // 防止移动端页面滚动

    var target = e.target.closest('.piece');
    if (!target) return;

    var id = parseInt(target.dataset.id, 10);
    dragPiece = null;
    for (var i = 0; i < pieces.length; i++) {
        if (pieces[i].id === id) {
            dragPiece = pieces[i];
            break;
        }
    }
    if (!dragPiece) return;

    var pos = getEventPos(e);
    startX = pos.x;
    startY = pos.y;
    isDragging = true;

    dragPiece.el.classList.add('dragging');
}

/**
 * 移动 / 触摸滑动
 */
function handleMove(e) {
    if (!isDragging || !dragPiece || !isGameActive) return;
    e.preventDefault();

    var pos = getEventPos(e);
    var dx = pos.x - startX;
    var dy = pos.y - startY;

    // 判断滑动方向，只有超过阈值才触发移动
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        var direction = null;

        // 根据主要滑动方向判定
        if (Math.abs(dx) > Math.abs(dy)) {
            direction = dx > 0 ? 'right' : 'left';
        } else {
            direction = dy > 0 ? 'down' : 'up';
        }

        // 尝试移动
        var moved = movePiece(dragPiece, direction);

        if (moved) {
            // 移动成功后，重置起点，支持连续滑动
            startX = pos.x;
            startY = pos.y;
        }
        // 如果被阻挡，不重置起点，防止微小抖动导致误判
    }
}

/**
 * 松开 / 触摸结束
 */
function handleEnd(e) {
    if (!isDragging) return;

    if (dragPiece) {
        dragPiece.el.classList.remove('dragging');

        // 计算手指/鼠标抬起时的位置
        var pos = getEventPos(e);
        var dx = Math.abs(pos.x - startX);
        var dy = Math.abs(pos.y - startY);

        // 如果滑动距离极小（视为点击），尝试自动寻找唯一可移动方向
        if (dx < 10 && dy < 10) {
            handleAutoMove(dragPiece);
        }
    }

    isDragging = false;
    dragPiece = null;
}

/**
 * 点击时自动寻找唯一可移动方向（优化体验）
 */
function handleAutoMove(piece) {
    var directions = ['up', 'down', 'left', 'right'];
    var validMoves = [];

    for (var i = 0; i < directions.length; i++) {
        if (canMove(piece, directions[i])) {
            validMoves.push(directions[i]);
        }
    }

    // 如果只有一个方向可走，则自动移动
    if (validMoves.length === 1) {
        movePiece(piece, validMoves[0]);
    }
}

// ================= 绑定交互事件 =================

// 鼠标事件
boardEl.addEventListener('mousedown',  handleStart);
boardEl.addEventListener('mousemove',  handleMove);
boardEl.addEventListener('mouseup',    handleEnd);
boardEl.addEventListener('mouseleave', handleEnd);

// 触摸事件（passive: false 以允许 preventDefault）
boardEl.addEventListener('touchstart', handleStart, { passive: false });
boardEl.addEventListener('touchmove',  handleMove,  { passive: false });
boardEl.addEventListener('touchend',   handleEnd);

// ================= 胜利与重置逻辑 =================

function triggerWin() {
    isGameActive = false;
    finalStepsEl.textContent = steps;

    // 延迟一点显示弹窗，让最后的滑动动画播完
    setTimeout(function() {
        winModal.classList.remove('modal-hidden');
    }, 300);
}

function resetGame() {
    winModal.classList.add('modal-hidden');
    initGame();
}

// ================= 启动页与音乐逻辑 =================

/**
 * 点击"点击入阵"按钮
 * 【修复】确保事件绑定 id 与 HTML 一致，遮罩层彻底消失，音乐播放带 catch
 */
startBtn.addEventListener('click', function() {
    console.log('【调试】start-btn 被点击');

    // 1. 遮罩层淡出并彻底消失
    startScreen.classList.add('fade-out');

    // 2. 初始化游戏棋盘
    initGame();
    console.log('【调试】initGame() 已调用');

    // 3. 尝试播放背景音乐（处理浏览器自动播放限制）
    bgm.volume = 0.5; // 设置音量为 50%
    var playPromise = bgm.play();
    if (playPromise !== undefined) {
        playPromise.catch(function(error) {
            console.log('音乐播放失败:', error);
        });
    }
});

// 结算弹窗 —— 再战一局
replayBtn.addEventListener('click', function() {
    resetGame();
});

// 重置棋局按钮
resetBtn.addEventListener('click', function() {
    if (confirm('确定要重置棋局吗？')) {
        resetGame();
    }
});