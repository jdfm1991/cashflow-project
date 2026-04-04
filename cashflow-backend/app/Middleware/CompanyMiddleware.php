<?php
// app/Middleware/CompanyMiddleware.php
declare(strict_types=1);

namespace App\Middleware;

use App\Helpers\Response;
use App\Models\User;
use App\Models\Company;

class CompanyMiddleware
{
    private User $userModel;
    private Company $companyModel;
    
    public function __construct()
    {
        $this->userModel = new User();
        $this->companyModel = new Company();
    }
    
    /**
     * Manejar la autenticación y selección de empresa
     */
    public function handle(): bool
    {
        $userId = $_REQUEST['user_id'] ?? null;
        $companyId = $_SERVER['HTTP_X_COMPANY_ID'] ?? $_REQUEST['company_id'] ?? null;
        
        if (!$userId) {
            Response::unauthorized('Usuario no autenticado');
            return false;
        }
        
        // Obtener el usuario
        $user = $this->userModel->find($userId);
        
        if (!$user) {
            Response::unauthorized('Usuario no encontrado');
            return false;
        }
        
        // Si no se especifica empresa, usar la del usuario
        if (!$companyId) {
            $companyId = $user['company_id'];
        }
        
        // Verificar que el usuario pertenece a la empresa
        if ($user['company_id'] != $companyId) {
            Response::forbidden('No tienes acceso a esta empresa');
            return false;
        }
        
        // Verificar que la empresa está activa
        $company = $this->companyModel->find($companyId);
        
        if (!$company || !$company['is_active']) {
            Response::forbidden('Empresa no disponible');
            return false;
        }
        
        // Verificar suscripción
        if (!$this->companyModel->isSubscriptionActive()) {
            Response::forbidden('La suscripción de la empresa ha expirado');
            return false;
        }
        
        // Guardar company_id en el contexto
        $_REQUEST['company_id'] = $companyId;
        $_SERVER['COMPANY_ID'] = $companyId;
        
        // Establecer company_id en los modelos
        \App\Models\BaseModel::setCurrentCompanyId($companyId);
        
        return true;
    }
}