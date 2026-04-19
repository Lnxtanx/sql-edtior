
import { parse } from 'pgsql-ast-parser';

const sql = `
    CREATE VIEW public.active_users AS 
    SELECT u.id, u.email, p.full_name 
    FROM public.users u 
    JOIN public.profiles p ON u.id = p.user_id 
    WHERE u.is_active = true;
`;

try {
    const ast = parse(sql);
    console.log(JSON.stringify(ast, null, 2));
} catch (e) {
    console.error(e);
}
