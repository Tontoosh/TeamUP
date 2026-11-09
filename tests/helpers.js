import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';

// Exercise the complete Express middleware/router stack without opening a socket.
// The workspace sandbox does not allow binding localhost ports.
export function client(app) {
  let cookie = '';
  return {
    async request(method, path, body, extraHeaders = {}) {
      const socket = new Duplex({
        read() {},
        write(_chunk, _encoding, callback) {
          callback();
        },
      });
      const req = new IncomingMessage(socket);
      req.method = method;
      req.url = `/api${path}`;
      let payload;
      let headers = { host: 'localhost', ...extraHeaders };
      if (body instanceof FormData) {
        const source = new Request('http://localhost', { method: 'POST', body });
        payload = Buffer.from(await source.arrayBuffer());
        headers['content-type'] = source.headers.get('content-type');
      } else if (body !== undefined) {
        payload = Buffer.from(JSON.stringify(body));
        headers['content-type'] = 'application/json';
      }
      if (payload) headers['content-length'] = String(payload.length);
      if (cookie) headers.cookie = cookie;
      req.headers = headers;
      req.push(payload || null);
      if (payload) req.push(null);
      return new Promise((resolve, reject) => {
        const res = new ServerResponse(req);
        const chunks = [];
        res.write = (chunk, encoding, callback) => {
          chunks.push(
            Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined)
          );
          if (typeof callback === 'function') callback();
          return true;
        };
        res.end = chunk => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          const setCookie = res.getHeader('set-cookie');
          if (setCookie)
            cookie =
              (Array.isArray(setCookie) ? setCookie : [setCookie])
                .find(value => value.startsWith('teamup_session='))
                ?.split(';')[0] || cookie;
          const raw = Buffer.concat(chunks).toString('utf8');
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          res.emit('finish');
          resolve({ status: res.statusCode, data, raw, headers: res.getHeaders() });
          return res;
        };
        app.handle(req, res, reject);
      });
    },
    async login(email = 'student@teamup.mn') {
      const response = await this.request('POST', '/auth/login', { email, password: 'Teamup123!' });
      if (response.status !== 200) throw new Error(JSON.stringify(response));
      return response;
    },
  };
}
export const projectData = (changes = {}) => ({
  name: 'Туршилтын төсөл',
  description: 'Шинэ санааг хэрэгжүүлэх туршилтын төслийн тайлбар.',
  category: 'EdTech',
  project_type: 'Стартап',
  goal: 'Хамтран бүтээгдэхүүн хөгжүүлж турших зорилго.',
  duration: 12,
  capacity: 3,
  skills: ['React'],
  roles: ['Хөгжүүлэгч', 'Дизайнер'],
  hours: 8,
  ...changes,
});
