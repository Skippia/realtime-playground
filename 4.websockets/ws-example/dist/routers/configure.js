"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = configure;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const api_js_1 = __importDefault(require("./api.js"));
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
function configure(app) {
    app
        .get('/', (req, res, next) => {
        res.sendFile(path_1.default.resolve(__dirname, '../../frontend/index.html'));
    })
        .use(express_1.default.static('frontend'))
        .use(express_1.default.json())
        .use('/api', (0, api_js_1.default)())
        .use('/error', (req, res, next) => {
        next(new Error('Other Error'));
    })
        .use((req, res, next) => {
        next(new Error('Not Found'));
    })
        .use((error, req, res, next) => {
        if (error.message === 'Not Found') {
            res.sendFile(path_1.default.resolve(__dirname, '../../frontend/not-found.html'));
            return;
        }
        res.sendFile(path_1.default.resolve(__dirname, '../../frontend/error.html'));
    });
}
