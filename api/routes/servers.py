import re
from flask import Blueprint, request, jsonify, g
from database import (
    list_user_servers, count_user_servers,
    create_user_server, delete_user_server, MAX_USER_SERVERS,
)
from utils import require_auth

servers_bp = Blueprint('servers', __name__)

CFX_CODE_RE = re.compile(r'^[a-z0-9]{4,10}$')


def _serialize(row: dict) -> dict:
    return {
        'id':         row['id'],
        'name':       row['name'],
        'cfx_code':   row['cfx_code'],
        'created_at': row.get('created_at'),
    }


@servers_bp.route('/servers', methods=['GET'])
@require_auth
def get_servers():
    rows = list_user_servers(g.user_id)
    return jsonify([_serialize(r) for r in rows])


@servers_bp.route('/servers', methods=['POST'])
@require_auth
def add_server():
    data     = request.get_json() or {}
    name     = str(data.get('name', '')).strip()
    cfx_code = str(data.get('cfx_code', '')).strip().lower()

    if not name:
        return jsonify({'error': 'Nome do servidor é obrigatório'}), 400
    if len(name) > 40:
        return jsonify({'error': 'Nome deve ter no máximo 40 caracteres'}), 400
    if not CFX_CODE_RE.match(cfx_code):
        return jsonify({'error': 'Código cfx.re inválido'}), 400

    if count_user_servers(g.user_id) >= MAX_USER_SERVERS:
        return jsonify({'error': f'Limite de {MAX_USER_SERVERS} servidores personalizados atingido'}), 409

    row = create_user_server(g.user_id, name, cfx_code)
    return jsonify(_serialize(row)), 201


@servers_bp.route('/servers/<int:server_id>', methods=['DELETE'])
@require_auth
def remove_server(server_id):
    deleted = delete_user_server(g.user_id, server_id)
    if not deleted:
        return jsonify({'error': 'Servidor não encontrado'}), 404
    return jsonify({'message': 'Servidor removido'})
