"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = users;
const express_1 = require("express");
function users() {
    const router = (0, express_1.Router)();
    router
        .get('/', (req, res, next) => {
        res.json({
            id: 1,
            firstname: 'Matt',
            lastname: 'Morgan',
        });
    })
        .post(['/', '/:id'], (req, res, next) => {
        const params = req.params;
        const id = params.id;
        const queryParams = req.query;
    });
    return router;
}
